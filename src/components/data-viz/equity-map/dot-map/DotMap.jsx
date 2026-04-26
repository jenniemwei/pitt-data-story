"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId } from "../../../../lib/equity-map/constants";
import { lincolnLemingtonBelmarNorthCapLatFromHoods } from "../../../../lib/equity-map/llbNorthCap";
import { buildDotMapGeojson, transitSizeLegendFixed } from "../../../../lib/equity-map/dot-map/buildGeojson";
import { rowServesP10Or71B } from "../../../../lib/equity-map/dot-map/routeFilter";
import {
  ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG,
  simplifyRouteGeometry,
} from "../../../../lib/equity-map/simplifyRouteGeometry";
import { dataAssetUrl } from "../../../../lib/dataAssetUrl";
import { restrictMapboxFreeformZoom } from "../../../../lib/mapboxRestrictZoom";
import {
  circleRadiusGroundMatchExpression,
  DOT_MAP_RESOLUTION_STEPS,
  TRANSIT_LEGEND_RADIUS,
} from "./mapboxPaint";
import styles from "./DotMap.module.css";

// map styles
const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.1;
const DOT_MAP_REGION_FILL = "#F2EEE9";
const POVERTY_LEVEL_COLORS = ["#D1CDC8", "#FFA883", "#D85C4D"];
const ROUTE_ELIMINATED_LIGHT_GREY = "#d6d6d6";
const ROUTE_REDUCED_DARK_GREY = "#5c5c5c";
const ROUTE_VISUAL = {
  existing: "existing",
  stop_reduction: "stop_reduction",
  hours_stop_reduction: "hours_stop_reduction",
  hours_reduction: "hours_reduction",
  elimination: "elimination",
};
const ROUTES_ELIMINATED_PAINT = {
  "line-color": ROUTE_ELIMINATED_LIGHT_GREY,
  "line-width": 2,
  "line-opacity": 1,
  "line-dasharray": [1, 0],
};
const ROUTES_AFTER_DETAILED_PAINT = {
  "line-color": [
    "match",
    ["get", "route_visual"],
    ROUTE_VISUAL.existing,
    "#111111",
    ROUTE_VISUAL.stop_reduction,
    "#5c5c5c",
    ROUTE_VISUAL.hours_reduction,
    "#767676",
    ROUTE_VISUAL.hours_stop_reduction,
    "#686868",
    "#8f8f8f",
  ],
  "line-opacity": 1,
  "line-width": 2,
  "line-dasharray": [1, 0],
};
const HOOD_FEATURED_OUTLINE_PAINT = {
  "line-color": "#2c7be5",
  "line-width": 1.3,
  "line-opacity": 0.9,
};
const HOOD_HOVER_OUTLINE_PAINT = {
  "line-color": "#111",
  "line-width": 1.3,
};

/** Featured story neighborhoods — blue outline on the map. */
const FEATURED_HOODS = new Set(["Highland Park", "Crafton Heights"]);
const ROUTE_26_HIGHLIGHT = "#c2410c";

/** Padding for fitBounds; max zoom caps how far fit can zoom in. */
const DOT_MAP_FIT_PADDING = { top: 28, bottom: 28, left: 24, right: 24 };
const DOT_MAP_FIT_MAX_ZOOM = 12.2;
/** Step for toolbar zoom in / out (Mapbox still clamps to min/max zoom). */
const DOT_MAP_STEP_ZOOM = 0.65;
/** Rounded min-zoom avoids float jitter between identical fits. */
const MIN_ZOOM_DECIMALS = 2;
const WALKSHED_RADIUS_MILES = 0.25;
const WALKSHED_EDGE_OPACITY_ACTIVE = 0.02;
const WALKSHED_CENTER_OPACITY_REDUCED = 0.2;
const WALKSHED_CENTER_OPACITY_ACTIVE = 0.6;
const EARTH_CIRCUMFERENCE_M = 40075017;

function roundZoom(z) {
  const f = 10 ** MIN_ZOOM_DECIMALS;
  return Math.round(z * f) / f;
}

function metersPerPixelAtLatZoom(latDeg, zoom) {
  const latRad = (latDeg * Math.PI) / 180;
  return (Math.cos(latRad) * EARTH_CIRCUMFERENCE_M) / (2 ** zoom * 512);
}

function radiusPxForMiles(latDeg, zoom, miles) {
  const meters = miles * 1609.344;
  return meters / metersPerPixelAtLatZoom(latDeg, zoom);
}

function walkshedRadiusExpression(miles) {
  const lat = MAP_CENTER[1];
  const z = MAP_INITIAL_ZOOM;
  const at = (zoom) => radiusPxForMiles(lat, zoom, miles);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    z,
    at(z),
    z + 2,
    at(z + 2),
    z + 4,
    at(z + 4),
    z + 6.5,
    at(z + 6.5),
  ];
}

/**
 * After fitBounds, lock min zoom on idle so Mapbox has settled (avoids rAF/moveend races).
 * @param {import('mapbox-gl').Map} map
 * @param {React.MutableRefObject<number>} generationRef
 * @param {number} generation
 * @param {React.MutableRefObject<import('mapbox-gl').Map | null>} mapRef
 */
function scheduleMinZoomLock(map, generationRef, generation, mapRef) {
  map.once("idle", () => {
    if (generationRef.current !== generation || mapRef.current !== map || !map.isStyleLoaded()) return;
    map.setMinZoom(roundZoom(map.getZoom()));
  });
}

function prepareMapForFit(map) {
  map.setMinZoom(0);
}

function fitBoundsForBbox(map, b) {
  if (!b.every(Number.isFinite)) return false;
  map.fitBounds(
    [
      [b[0], b[1]],
      [b[2], b[3]],
    ],
    {
      padding: DOT_MAP_FIT_PADDING,
      duration: 0,
      maxZoom: DOT_MAP_FIT_MAX_ZOOM,
    },
  );
  return true;
}

/**
 * Full Pittsburgh neighborhood landmass (all non-water polygons).
 * @param {import('mapbox-gl').Map} map
 * @param {GeoJSON.FeatureCollection} hoodFc
 */
function fitFullCityNeighborhoodBounds(map, hoodFc) {
  const features = hoodFc.features.filter((f) => Number(f.properties?.is_water) !== 1);
  if (!features.length) return false;
  map.setMaxBounds(null);
  const b = turf.bbox({ type: "FeatureCollection", features });
  return fitBoundsForBbox(map, b);
}

/**
 * Story corridors: neighborhoods touched by 26+71B profile filter (`serves_p10_71b`).
 * @param {import('mapbox-gl').Map} map
 * @param {GeoJSON.FeatureCollection} hoodFc
 */
function fitStory26Corridor(map, hoodFc) {
  const features = hoodFc.features.filter((f) => {
    if (Number(f.properties?.is_water) === 1) return false;
    return Number(f.properties?.serves_p10_71b) === 1;
  });
  if (!features.length) return false;
  const bRaw = turf.bbox({ type: "FeatureCollection", features });
  if (!bRaw.every(Number.isFinite)) return false;
  const northCap = lincolnLemingtonBelmarNorthCapLatFromHoods(hoodFc);
  let b = bRaw;
  if (northCap != null) {
    b = [bRaw[0], bRaw[1], bRaw[2], Math.min(bRaw[3], northCap)];
    map.setMaxBounds([
      [b[0], b[1]],
      [b[2], northCap],
    ]);
  } else {
    map.setMaxBounds(null);
  }
  return fitBoundsForBbox(map, b);
}

/**
 * Same camera as "Recenter map": full Pittsburgh land bbox, clear max bounds, min-zoom lock on idle.
 * @param {import('mapbox-gl').Map} map
 * @param {GeoJSON.FeatureCollection} hoodFc
 * @param {React.MutableRefObject<number>} generationRef
 * @param {React.MutableRefObject<import('mapbox-gl').Map | null>} mapRef
 */
function applyRecenterCamera(map, hoodFc, generationRef, mapRef) {
  if (!hoodFc?.features?.length) return;
  prepareMapForFit(map);
  map.setMaxBounds(null);
  const generation = ++generationRef.current;
  if (!fitFullCityNeighborhoodBounds(map, hoodFc)) return;
  scheduleMinZoomLock(map, generationRef, generation, mapRef);
}

function fetchCsv(path) {
  return fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${path}`);
      return res.text();
    })
    .then((text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data);
}

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusFromRow(row) {
  if (row.route_status === "eliminated") return "eliminated";
  if (row.route_status === "reduced") return "reduced";
  return "no_change";
}

function reductionSubtype(row) {
  const detail = (row.primary_reduction_detail || "").toLowerCase();
  if (detail.includes("major frequency")) return "major_frequency_reduction";
  if (detail.includes("11:00 p.m")) return "reduced_hours_11pm";
  if (detail.includes("only")) return "shortened_alignment";
  return "";
}

function routeVisualKey(status, subtype) {
  if (status === "eliminated") return ROUTE_VISUAL.elimination;
  if (status === "no_change") return ROUTE_VISUAL.existing;
  if (status === "reduced") {
    if (subtype === "major_frequency_reduction") return ROUTE_VISUAL.stop_reduction;
    if (subtype === "reduced_hours_11pm") return ROUTE_VISUAL.hours_reduction;
    if (subtype === "shortened_alignment") return ROUTE_VISUAL.hours_stop_reduction;
    return ROUTE_VISUAL.stop_reduction;
  }
  return ROUTE_VISUAL.existing;
}

function classifyStopDowntownService(statusSet) {
  const hasUnchanged = statusSet.has("no_change");
  const hasReduced = statusSet.has("reduced");
  if (hasUnchanged) return "active";
  if (hasReduced) return "reduced";
  return "no_downtown";
}

/**
 * Bivariate dot map: regional lattice, poverty color × transit-dependent size; radii in ground meters.
 * @param {{ title?: string; dek?: string; showAllRoutesLabel?: string }} props
 */
export default function DotMap({ title, dek, showAllRoutesLabel = "All routes" }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  /** Enriched hood GeoJSON for camera bbox. */
  const hoodGeoCameraRef = useRef(/** @type {GeoJSON.FeatureCollection | null} */ (null));
  const dotMapFitGenerationRef = useRef(0);
  const [hoverData, setHoverData] = useState(null);
  const [viewMode, setViewMode] = useState(
    /** @type {"allRoutes" | "story26" | "hideRoutes"} */ ("allRoutes"),
  );
  const [showTransitDots, setShowTransitDots] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [routesMissing, setRoutesMissing] = useState(false);
  const [showWalksheds, setShowWalksheds] = useState(false);
  /** When true, drag-to-pan is enabled on the map; zoom is only via buttons. */
  const [panMode, setPanMode] = useState(false);
  /** Bumps after camera moves so zoom button disabled states stay in sync. */
  const [navTick, setNavTick] = useState(0);
  const bumpNav = useCallback(() => setNavTick((n) => n + 1), []);
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  const transitSizeLegend = useMemo(() => transitSizeLegendFixed(), []);

  useEffect(() => {
    if (!token || !mapContainerRef.current) return;
    mapboxgl.accessToken = token;

    let cancelled = false;

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetchCsv(dataAssetUrl("fy26_route_n_profiles_all.csv")),
      fetchCsv(dataAssetUrl("FY26_route_status_all.csv")),
      fetchCsv(dataAssetUrl("route_stop_per_route.csv")),
      fetch(dataAssetUrl("route_lines_current.geojson"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([hoodGeo, hoodStats, routeStats, stopRows, routeGeo]) => {
      if (cancelled) return;

      const hoodByName = new Map();
      hoodStats.forEach((row) => {
        const name = (row.neighborhood || "").trim();
        if (!name) return;
        const streetBefore = safeFloat(row.routes_before_street_count);
        const streetLosing = safeFloat(row.routes_losing_street_count);
        const allBefore = safeFloat(row.routes_before_count);
        const allLosing = safeFloat(row.routes_losing_count);
        const useStreet = streetBefore > 0;
        const routesBefore = useStreet ? streetBefore : allBefore;
        const routesLosing = useStreet ? streetLosing : allLosing;
        hoodByName.set(name, {
          poverty_rate: safeFloat(row.below_poverty_pct),
          pct_transit_dependent: safeFloat(row.transit_dependent_pct_proxy),
          routes_cut_or_reduced: useStreet ? row.routes_losing_street || "" : row.routes_losing || "",
          pct_access_lost: routesBefore > 0 ? routesLosing / routesBefore : 0,
          access_metric: useStreet ? "street" : "all_stops",
          serves_p10_71b: rowServesP10Or71B(row),
        });
      });

      hoodGeo.features = hoodGeo.features.map((f) => {
        const hood = f.properties?.hood || "";
        const m = hoodByName.get(hood) || {};
        const awater = safeFloat(f.properties?.awater10);
        const aland = safeFloat(f.properties?.aland10);
        const waterHeavy = awater > 0 && aland === 0;
        return {
          ...f,
          properties: {
            ...f.properties,
            neighborhood_name: hood,
            poverty_rate: m.poverty_rate ?? 0,
            pct_transit_dependent: m.pct_transit_dependent ?? 0,
            pct_no_car: m.pct_transit_dependent ?? 0,
            routes_cut_or_reduced: m.routes_cut_or_reduced ?? "",
            pct_access_lost: m.pct_access_lost ?? 0,
            access_metric: m.access_metric ?? "all_stops",
            is_water: waterHeavy ? 1 : 0,
            is_featured: FEATURED_HOODS.has(hood) ? 1 : 0,
            serves_p10_71b: m.serves_p10_71b ?? 0,
          },
        };
      });

      hoodGeoCameraRef.current = hoodGeo;

      const builtPerStep = DOT_MAP_RESOLUTION_STEPS.map((step) =>
        buildDotMapGeojson(hoodGeo, { cellKm: step.cellKm }),
      );
      const dotsLayers = builtPerStep.map((b) => b.dots);
      const { hoodsSimplified } = builtPerStep[builtPerStep.length - 1];

      const routeById = new Map();
      routeStats.forEach((row) => {
        const raw = (row.route_code || "").trim().toUpperCase();
        const id = normalizeRouteId(raw);
        if (!id) return;
        const st = statusFromRow(row);
        const sub = reductionSubtype(row);
        const payload = {
          route_status: st,
          reduction_subtype: sub,
          route_visual: routeVisualKey(st, sub),
          route_name: row.schedule_name || row.route_label || id,
        };
        routeById.set(id, payload);
        if (raw && raw !== id) routeById.set(raw, payload);
      });

      /** @type {GeoJSON.FeatureCollection | null} */
      let routeAllGeo = null;
      if (routeGeo?.features?.length) {
        routeAllGeo = {
          type: "FeatureCollection",
          features: routeGeo.features.map((f) => {
            const rawId = String(f.properties?.route_id || f.properties?.route_code || "")
              .trim()
              .toUpperCase();
            const rid = normalizeRouteId(rawId);
            const found = routeById.get(rid);
            return {
              ...f,
              geometry: simplifyRouteGeometry(f.geometry, ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG),
              properties: {
                ...f.properties,
                route_id: rid,
                route_name: found?.route_name || f.properties?.route_name || rid,
                route_status: found?.route_status || "no_change",
                reduction_subtype: found?.reduction_subtype || "",
                route_visual: found?.route_visual || ROUTE_VISUAL.existing,
              },
            };
          }),
        };
      }

      let routeP1071bGeo = null;
      if (routeGeo?.features?.length) {
        routeP1071bGeo = {
          type: "FeatureCollection",
          features: routeGeo.features
            .map((f) => {
              const rawId = String(f.properties?.route_id || f.properties?.route_code || "")
                .trim()
                .toUpperCase();
              const rid = normalizeRouteId(rawId);
              if (rid !== "26" && rid !== "71B") return null;
              return {
                ...f,
                geometry: simplifyRouteGeometry(f.geometry, ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG),
                properties: {
                  ...f.properties,
                  route_id: rid,
                  route_name: f.properties?.route_name || rid,
                },
              };
            })
            .filter(Boolean),
        };
        if (!routeP1071bGeo.features.length) {
          routeP1071bGeo = null;
        }
      }
      setRoutesMissing(!routeP1071bGeo?.features?.length);

      const neighborhoodNames = new Set(
        hoodGeo.features.map((f) => String(f.properties?.hood || "").trim()).filter(Boolean),
      );
      const stopMap = new Map();
      stopRows.forEach((row) => {
        if (String(row.mode || "").toUpperCase() !== "BUS") return;
        if (String(row.direction || "").trim().toUpperCase() !== "IB") return;
        const stopId = String(row.stop_id || "").trim();
        if (!stopId) return;
        const hood = String(row.hood || "").trim();
        if (!neighborhoodNames.has(hood)) return;
        const route = normalizeRouteId(row.route_id || row.routes || row.route_filter || "");
        if (!route) return;
        const status = routeById.get(route)?.route_status || "no_change";
        const lat = Number(row.stop_lat || row.y);
        const lon = Number(row.stop_lon || row.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
        const existing = stopMap.get(stopId) || {
          stopId,
          stopName: String(row.stop_name || stopId),
          hood,
          lat,
          lon,
          routeStatuses: new Set(),
        };
        existing.routeStatuses.add(status);
        stopMap.set(stopId, existing);
      });
      const stopGeo = {
        type: "FeatureCollection",
        features: Array.from(stopMap.values()).map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: {
            stop_id: s.stopId,
            stop_name: s.stopName,
            hood: s.hood || "Unknown",
            service_class: classifyStopDowntownService(s.routeStatuses),
          },
        })),
      };

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: FLAT_BASEMAP_STYLE,
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      restrictMapboxFreeformZoom(map, { preserveDragPan: false });

      map.on("load", () => {
        if (cancelled) return;

        map.addSource("dot-map-hood-hit", { type: "geojson", data: hoodsSimplified });
        map.addLayer({
          id: "dot-map-pgh-land-fill",
          type: "fill",
          source: "dot-map-hood-hit",
          filter: ["!=", ["to-number", ["get", "is_water"]], 1],
          paint: {
            "fill-color": DOT_MAP_REGION_FILL,
            "fill-opacity": 1,
          },
        });

        DOT_MAP_RESOLUTION_STEPS.forEach((step, i) => {
          map.addSource(`dot-map-equity-dots-${i}`, { type: "geojson", data: dotsLayers[i] });
          /** @type {import('mapbox-gl').AnyLayer} */
          const layer = {
            id: `dot-map-equity-dots-circle-${i}`,
            type: "circle",
            source: `dot-map-equity-dots-${i}`,
            paint: {
              "circle-color": ["get", "dot_color"],
              "circle-radius": circleRadiusGroundMatchExpression(step.cellKm),
              "circle-opacity": 1,
              "circle-stroke-width": 0,
            },
          };
          if (step.minZoom != null) layer.minzoom = step.minZoom;
          if (step.maxZoom != null) layer.maxzoom = step.maxZoom;
          map.addLayer(layer);
        });

        if (routeAllGeo?.features?.length) {
          map.addSource("dot-map-routes-all", { type: "geojson", data: routeAllGeo });
          map.addLayer({
            id: "dot-map-routes-all-eliminated",
            type: "line",
            source: "dot-map-routes-all",
            filter: ["==", ["get", "route_visual"], ROUTE_VISUAL.elimination],
            paint: ROUTES_ELIMINATED_PAINT,
            layout: { visibility: "none" },
          });
          map.addLayer({
            id: "dot-map-routes-all-after",
            type: "line",
            source: "dot-map-routes-all",
            filter: ["!=", ["get", "route_visual"], ROUTE_VISUAL.elimination],
            paint: ROUTES_AFTER_DETAILED_PAINT,
            layout: { visibility: "none" },
          });
        }

        if (routeP1071bGeo?.features?.length) {
          map.addSource("dot-map-routes-p10-71b", { type: "geojson", data: routeP1071bGeo });
          map.addLayer({
            id: "dot-map-equity-routes-p10-71b",
            type: "line",
            source: "dot-map-routes-p10-71b",
            paint: {
              "line-color": [
                "match",
                ["get", "route_id"],
                "26",
                ROUTE_26_HIGHLIGHT,
                "71B",
                ROUTE_REDUCED_DARK_GREY,
                ROUTE_REDUCED_DARK_GREY,
              ],
              "line-width": 2.5,
              "line-opacity": 1,
              "line-dasharray": [1, 0],
            },
          });
        }

        map.addSource("dot-map-downtown-stops", { type: "geojson", data: stopGeo });
        const walkshedRadius = walkshedRadiusExpression(WALKSHED_RADIUS_MILES);
        map.addLayer({
          id: "dot-map-walkshed-active-edge-floor",
          type: "circle",
          source: "dot-map-downtown-stops",
          filter: ["==", ["get", "service_class"], "active"],
          layout: { visibility: "none" },
          paint: {
            "circle-radius": walkshedRadius,
            "circle-color": "#000000",
            "circle-opacity": WALKSHED_EDGE_OPACITY_ACTIVE,
          },
        });
        map.addLayer({
          id: "dot-map-walkshed-active-gradient",
          type: "circle",
          source: "dot-map-downtown-stops",
          filter: ["==", ["get", "service_class"], "active"],
          layout: { visibility: "none" },
          paint: {
            "circle-radius": walkshedRadius,
            "circle-color": "#000000",
            "circle-opacity": WALKSHED_CENTER_OPACITY_ACTIVE,
            "circle-blur": 1,
          },
        });
        map.addLayer({
          id: "dot-map-walkshed-reduced-gradient",
          type: "circle",
          source: "dot-map-downtown-stops",
          filter: ["==", ["get", "service_class"], "reduced"],
          layout: { visibility: "none" },
          paint: {
            "circle-radius": walkshedRadius,
            "circle-color": "#000000",
            "circle-opacity": WALKSHED_CENTER_OPACITY_REDUCED,
            "circle-blur": 1,
          },
        });
        map.addLayer({
          id: "dot-map-walkshed-stop-dots",
          type: "circle",
          source: "dot-map-downtown-stops",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 2,
            "circle-color": "#111827",
            "circle-opacity": 0.8,
            "circle-stroke-width": 0,
          },
        });

        map.addLayer({
          id: "dot-map-hood-hit-fill",
          type: "fill",
          source: "dot-map-hood-hit",
          paint: { "fill-opacity": 0 },
        });
        map.addLayer({
          id: "dot-map-hood-featured-outline",
          type: "line",
          source: "dot-map-hood-hit",
          filter: ["==", ["get", "is_featured"], 1],
          paint: HOOD_FEATURED_OUTLINE_PAINT,
        });
        map.addLayer({
          id: "dot-map-hood-hover-outline",
          type: "line",
          source: "dot-map-hood-hit",
          filter: ["==", ["get", "neighborhood_name"], ""],
          paint: HOOD_HOVER_OUTLINE_PAINT,
        });

        map.on("mousemove", "dot-map-hood-hit-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const p = feature.properties || {};
          setHoverData({
            name: p.neighborhood_name,
            pctTransit: safeFloat(p.pct_transit_dependent),
            povertyRate: safeFloat(p.poverty_rate),
            routesCut: p.routes_cut_or_reduced,
            pctAccessLost: safeFloat(p.pct_access_lost),
            accessMetric: p.access_metric === "street" ? "street" : "all_stops",
          });
          map.setFilter("dot-map-hood-hover-outline", ["==", ["get", "neighborhood_name"], p.neighborhood_name]);
        });

        map.on("mouseleave", "dot-map-hood-hit-fill", () => {
          setHoverData(null);
          map.setFilter("dot-map-hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
        });

        if (!cancelled) {
          applyRecenterCamera(map, hoodGeo, dotMapFitGenerationRef, mapRef);
          setMapReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      setRoutesMissing(false);
      setViewMode("allRoutes");
      setShowTransitDots(true);
      setPanMode(false);
      setShowWalksheds(false);
      hoodGeoCameraRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    if (panMode) map.dragPan.enable();
    else map.dragPan.disable();
  }, [panMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    const onCam = () => bumpNav();
    map.on("zoomend", onCam);
    map.on("moveend", onCam);
    bumpNav();
    return () => {
      map.off("zoomend", onCam);
      map.off("moveend", onCam);
    };
  }, [mapReady, bumpNav]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;

    const story26 = viewMode === "story26";
    const routeOnly = story26 ? ["==", ["to-number", ["get", "serves_p10_71b"]], 1] : null;

    DOT_MAP_RESOLUTION_STEPS.forEach((_, i) => {
      const id = `dot-map-equity-dots-circle-${i}`;
      if (map.getLayer(id)) {
        map.setFilter(id, routeOnly);
      }
    });
    const landOnly = ["!=", ["to-number", ["get", "is_water"]], 1];
    if (map.getLayer("dot-map-pgh-land-fill")) {
      map.setFilter(
        "dot-map-pgh-land-fill",
        story26 ? ["all", landOnly, ["==", ["to-number", ["get", "serves_p10_71b"]], 1]] : landOnly,
      );
    }
    if (map.getLayer("dot-map-hood-hit-fill")) {
      map.setFilter("dot-map-hood-hit-fill", routeOnly);
    }
    if (map.getLayer("dot-map-hood-featured-outline")) {
      map.setFilter(
        "dot-map-hood-featured-outline",
        story26
          ? [
              "all",
              ["==", ["to-number", ["get", "is_featured"]], 1],
              ["==", ["to-number", ["get", "serves_p10_71b"]], 1],
            ]
          : ["==", ["to-number", ["get", "is_featured"]], 1],
      );
    }
    setHoverData(null);
    if (map.getLayer("dot-map-hood-hover-outline")) {
      map.setFilter("dot-map-hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
    }

    const visFullNetwork = viewMode === "allRoutes" ? "visible" : "none";
    const visStory = viewMode === "story26" ? "visible" : "none";
    const eliminatedOnly = ["==", ["get", "route_visual"], ROUTE_VISUAL.elimination];
    const notEliminated = ["!=", ["get", "route_visual"], ROUTE_VISUAL.elimination];

    if (map.getLayer("dot-map-routes-all-eliminated")) {
      map.setLayoutProperty("dot-map-routes-all-eliminated", "visibility", visFullNetwork);
      map.setFilter("dot-map-routes-all-eliminated", eliminatedOnly);
    }
    if (map.getLayer("dot-map-routes-all-after")) {
      map.setLayoutProperty("dot-map-routes-all-after", "visibility", visFullNetwork);
      map.setFilter("dot-map-routes-all-after", notEliminated);
    }
    if (map.getLayer("dot-map-equity-routes-p10-71b")) {
      map.setLayoutProperty("dot-map-equity-routes-p10-71b", "visibility", visStory);
    }
  }, [viewMode, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;
    const vis = showTransitDots ? "visible" : "none";
    DOT_MAP_RESOLUTION_STEPS.forEach((_, i) => {
      const id = `dot-map-equity-dots-circle-${i}`;
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, "visibility", vis);
      // Defensive: ensure poverty/transit dot colors cannot remain visible after toggle-off.
      map.setPaintProperty(id, "circle-opacity", showTransitDots ? 1 : 0);
    });

    if (map.getLayer("dot-map-pgh-land-fill")) {
      map.setPaintProperty(
        "dot-map-pgh-land-fill",
        "fill-color",
        showTransitDots
          ? DOT_MAP_REGION_FILL
          : [
              "case",
              [">=", ["to-number", ["get", "poverty_rate"]], 0.2],
              POVERTY_LEVEL_COLORS[2],
              POVERTY_LEVEL_COLORS[0],
            ],
      );
    }
  }, [showTransitDots, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;
    const vis = showWalksheds ? "visible" : "none";
    [
      "dot-map-walkshed-active-edge-floor",
      "dot-map-walkshed-active-gradient",
      "dot-map-walkshed-reduced-gradient",
      "dot-map-walkshed-stop-dots",
    ].forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", vis);
    });
  }, [showWalksheds, mapReady]);

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    const hoodFc = hoodGeoCameraRef.current;
    if (!map?.isStyleLoaded() || !hoodFc?.features?.length) return;
    applyRecenterCamera(map, hoodFc, dotMapFitGenerationRef, mapRef);
  }, []);

  const stepMapZoom = useCallback(
    (delta) => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      const z = map.getZoom();
      const next = roundZoom(
        Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), z + delta)),
      );
      if (Math.abs(next - z) < 1e-4) return;
      map.easeTo({ zoom: next, duration: 240 });
    },
    [],
  );

  const { canZoomIn, canZoomOut } = useMemo(() => {
    const m = mapRef.current;
    if (!mapReady || !m?.isStyleLoaded()) {
      return { canZoomIn: false, canZoomOut: false };
    }
    const z = m.getZoom() + navTick * 0;
    const minZ = m.getMinZoom();
    const maxZ = m.getMaxZoom();
    return {
      canZoomOut: z > minZ + 1e-3,
      canZoomIn: z < maxZ - 1e-3,
    };
  }, [mapReady, navTick]);

  if (!token) {
    return (
      <section className={styles.shell} aria-label="Poverty and transit dependence dot map">
        <p className={styles.warn}>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to render the map.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-label="Poverty and transit dependence dot map">
      {(title || dek) && (
        <header className={styles.intro}>
          {title ? <h2>{title}</h2> : null}
          {dek ? <p>{dek}</p> : null}
        </header>
      )}

      <div className={styles.mapControls} role="toolbar" aria-label="Map controls">
        <span className={styles.mapControlsLabel}>Routes</span>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlButton} ${viewMode === "allRoutes" ? styles.controlButtonActive : ""}`}
            onClick={() => setViewMode("allRoutes")}
          >
            {showAllRoutesLabel}
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${viewMode === "story26" ? styles.controlButtonActive : ""}`}
            onClick={() => setViewMode("story26")}
          >
            26 + 71B
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${viewMode === "hideRoutes" ? styles.controlButtonActive : ""}`}
            onClick={() => setViewMode("hideRoutes")}
          >
            Hide routes
          </button>
        </div>
        <span className={styles.mapControlsDivider} aria-hidden />
        <span className={styles.mapControlsLabel}>Transit dependence</span>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlButton} ${showTransitDots ? styles.controlButtonActive : ""}`}
            onClick={() => setShowTransitDots(true)}
            disabled={!mapReady}
          >
            Dots on
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${!showTransitDots ? styles.controlButtonActive : ""}`}
            onClick={() => setShowTransitDots(false)}
            disabled={!mapReady}
          >
            Solid fill only
          </button>
        </div>
        <span className={styles.mapControlsDivider} aria-hidden />
        <span className={styles.mapControlsLabel}>Walksheds</span>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlButton} ${showWalksheds ? styles.controlButtonActive : ""}`}
            onClick={() => setShowWalksheds((v) => !v)}
            disabled={!mapReady}
            aria-pressed={showWalksheds}
            title="Toggle downtown stop walksheds"
          >
            Stop walksheds
          </button>
        </div>
        <span className={styles.mapControlsDivider} aria-hidden />
        <span className={styles.mapControlsLabel}>Move</span>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.zoomButton}`}
            onClick={() => stepMapZoom(-DOT_MAP_STEP_ZOOM)}
            disabled={!mapReady || !canZoomOut}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${styles.zoomButton}`}
            onClick={() => stepMapZoom(DOT_MAP_STEP_ZOOM)}
            disabled={!mapReady || !canZoomIn}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${panMode ? styles.controlButtonActive : ""}`}
            onClick={() => setPanMode((p) => !p)}
            disabled={!mapReady}
            aria-pressed={panMode}
            aria-label={panMode ? "Turn off pan mode" : "Turn on pan mode"}
            title={panMode ? "Drag to pan (on)" : "Select to drag and pan the map"}
          >
            Pan map
          </button>
        </div>
        <button
          type="button"
          className={`${styles.controlButton} ${styles.recenterButton}`}
          onClick={recenterMap}
          disabled={!mapReady}
          aria-label="Recenter map on Pittsburgh neighborhood borders"
        >
          Recenter map
        </button>
      </div>

      <div className={styles.legendCard}>
        <p className={styles.legendHeading}>How to read the dot map</p>
        <div className={styles.legendGrid}>
          <span className={styles.legendRowLabel}>Poverty</span>
          <div className={styles.povertySwatches} role="list">
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: POVERTY_LEVEL_COLORS[0] }}
              />
              Below 20% poverty
            </span>
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: POVERTY_LEVEL_COLORS[2] }}
              />
              20% or more poverty
            </span>
          </div>
          <span className={styles.legendRowLabel}>Transit dependence</span>
          <div className={styles.transitSizeLegend}>
            {transitSizeLegend ? (
              <p className={styles.legendSizeCaption}>{transitSizeLegend.caption}</p>
            ) : null}
            <div className={styles.sizeDemo} role="list">
              {(transitSizeLegend?.entries ?? [
                { b: 2, label: "High — largest (touches at grid pitch)" },
                { b: 1, label: "Medium" },
                { b: 0, label: "Low / medium-low — smallest" },
              ]).map(({ b, label }) => {
                const d = Math.round(TRANSIT_LEGEND_RADIUS[b] * 10);
                return (
                  <span key={b} className={styles.sizeStep} role="listitem">
                    <span className={styles.sizeCircle} style={{ width: d, height: d }} />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.mapPane}>
          {routesMissing && (
            <p className={styles.routesWarn}>
              26/71B story overlay unavailable in route geometry data.
            </p>
          )}
          <div
            className={`${styles.mapCanvas} ${panMode ? styles.mapCanvasPan : ""}`}
            ref={mapContainerRef}
          />
        </div>
        <aside className={styles.sidepanel} aria-label="Neighborhood detail">
          {hoverData ? (
            <dl>
              <dt>Neighborhood</dt>
              <dd>{hoverData.name}</dd>
              <dt>Poverty rate</dt>
              <dd>
                <span className={styles.metric}>{(hoverData.povertyRate * 100).toFixed(1)}%</span>
              </dd>
              <dt>Transit dependence (commute proxy)</dt>
              <dd>
                <span className={styles.metric}>{(hoverData.pctTransit * 100).toFixed(1)}%</span>
              </dd>
              <dt>Routes cut / reduced</dt>
              <dd>{hoverData.routesCut || "None listed"}</dd>
              <dt>Route access lost</dt>
              <dd>
                <span className={styles.metric}>{(hoverData.pctAccessLost * 100).toFixed(1)}%</span>
                {hoverData.accessMetric === "street" ? " (street-served)" : ""}
              </dd>
            </dl>
          ) : (
            <p className={styles.warn}>Hover a neighborhood for numbers.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
