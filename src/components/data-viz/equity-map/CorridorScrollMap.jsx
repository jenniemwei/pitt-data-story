"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import clone from "@turf/clone";
import Papa from "papaparse";
import simplify from "@turf/simplify";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import sdStyles from "../scroll-demographics/ScrollDemographics.module.css";
import localStyles from "./CorridorScrollMap.module.css";
import {
  CORRIDOR_OFF_CORRIDOR_MUTED,
  CORRIDOR_QUARTILE_FILLS,
  DOT_MAP_REGION_FILL,
  FLAT_BASEMAP_STYLE,
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  ROUTES_AFTER_DETAILED_PAINT,
  ROUTES_ELIMINATED_PAINT,
  ROUTE_VISUAL,
  TRANSIT_DOT_NEUTRAL_GREY,
  WATER_FILL,
} from "./mapStyles";
import { DataRationaleIcon } from "../../ui/DataRationaleIcon";
import { fullStoryNarrative, scrollDemographicsNarrative } from "../../../data/narrative";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import {
  ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG,
  simplifyRouteGeometry,
} from "../../../lib/equity-map/simplifyRouteGeometry";
import { hoodNamesTouchingRoutes } from "../../../lib/equity-map/corridorRouteSegments";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import {
  binFromCuts,
  quartileUpperEdges,
  safeFloat,
  sortedProp,
} from "../../../lib/equity-map/quartileBins";
import {
  buildCorridorScrollDotsGeojson,
  transitSizeLegendFromCuts,
} from "../../../lib/equity-map/dot-map/buildGeojson";
import {
  circleRadiusGroundMatchExpression,
  DOT_MAP_RESOLUTION_STEPS,
} from "./dot-map/mapboxPaint";

const STORY_ROUTES = new Set(["71B", "P10"]);
const HOOD_SIMPLIFY_TOL = 0.00055;

/** Opening zoom; `minZoom` is set after each `fitBounds` to this view so users cannot zoom out past the framed corridor/regional extent. */
const CORRIDOR_MAP_INITIAL_ZOOM = MAP_INITIAL_ZOOM + 0.55;

/** 71B = protected/upgraded corridor (blue); P10 = eliminated corridor in story (coral). */
const ROUTE_71B_BLUE = "#1d4ed8";
const ROUTE_P10_CORAL = "#c2410c";
const CORRIDOR_ROUTE_LINE_WIDTH = 2.5;
const REGIONAL_ROUTE_LINE_WIDTH = 1;

/** @type {typeof fullStoryNarrative.corridorMap} */
const defaultCorridorCopy = fullStoryNarrative.corridorMap;

function fetchCsv(path) {
  return fetch(path)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load ${path}`);
      return res.text();
    })
    .then((text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data);
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/** Choropleth on corridor — quartiles among touched hoods. */
function fillExprCorridorPoverty() {
  return /** @type {const} */ ([
    "case",
    ["==", ["get", "on_corridor"], 0],
    CORRIDOR_OFF_CORRIDOR_MUTED,
    ["==", ["get", "is_water"], 1],
    WATER_FILL,
    [
      "match",
      ["get", "poverty_bin_c"],
      0,
      CORRIDOR_QUARTILE_FILLS[0],
      1,
      CORRIDOR_QUARTILE_FILLS[1],
      2,
      CORRIDOR_QUARTILE_FILLS[2],
      3,
      CORRIDOR_QUARTILE_FILLS[3],
      CORRIDOR_QUARTILE_FILLS[0],
    ],
  ]);
}

function hoodFillNeutralLand() {
  return /** @type {const} */ ([
    "case",
    ["==", ["get", "is_water"], 1],
    WATER_FILL,
    DOT_MAP_REGION_FILL,
  ]);
}

const fillOpacityCorridor = /** @type {const} */ ([
  "case",
  ["==", ["get", "on_corridor"], 0],
  0.22,
  ["==", ["get", "is_water"], 1],
  0.88,
  1,
]);

const fillOpacityNeutral = /** @type {const} */ ([
  "case",
  ["==", ["get", "is_water"], 1],
  0.88,
  1,
]);

/** Mapbox expression — dot fill for “both” step (poverty quartiles on touched hoods). */
function povertyQuartileDotColorExpr() {
  return [
    "match",
    ["to-number", ["get", "poverty_bin_c"]],
    0,
    CORRIDOR_QUARTILE_FILLS[0],
    1,
    CORRIDOR_QUARTILE_FILLS[1],
    2,
    CORRIDOR_QUARTILE_FILLS[2],
    3,
    CORRIDOR_QUARTILE_FILLS[3],
    CORRIDOR_QUARTILE_FILLS[0],
  ];
}

/**
 * Scroll-synced 71B / P10 Mapbox: poverty choropleth → grey transit dots (size) → both (poverty-colored dots + size).
 *
 * @param {{ copy?: typeof defaultCorridorCopy }} props
 */
export default function CorridorScrollMap({ copy = defaultCorridorCopy }) {
  const { steps, sectionIntro, sectionTitle, reducedMotionNote } = copy;
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const scrollStepRef = useRef(0);
  const hoodGeoRef = useRef(/** @type {GeoJSON.FeatureCollection | null} */ (null));
  const [hoverData, setHoverData] = useState(null);
  const [routesFileMissing, setRoutesFileMissing] = useState(false);
  const [scrollStep, setScrollStep] = useState(() => Math.max(0, copy.steps.length - 1));
  const [showFullEquityMap, setShowFullEquityMap] = useState(true);
  const [mapStyleReady, setMapStyleReady] = useState(false);
  const [transitDotLegend, setTransitDotLegend] = useState(/** @type {ReturnType<typeof transitSizeLegendFromCuts> | null} */ (null));
  const reduceMotion = usePrefersReducedMotion();
  /** Invalidate pending `moveend` when a new fit starts (phase, toggle, or manual recenter). */
  const corridorFitGenerationRef = useRef(0);

  const effectiveStep = reduceMotion ? steps.length - 1 : scrollStep;
  const activePhase = steps[effectiveStep]?.phase ?? "full";
  scrollStepRef.current = effectiveStep;

  const regionalEquityOn = activePhase === "full" && showFullEquityMap;

  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  const stepRefs = useRef(/** @type {(HTMLElement | null)[]} */ ([]));

  useEffect(() => {
    if (activePhase !== "full") setShowFullEquityMap(false);
  }, [activePhase]);

  const snappedDefaultStepRef = useRef(false);
  useLayoutEffect(() => {
    if (reduceMotion || snappedDefaultStepRef.current) return;
    const lastEl = stepRefs.current[steps.length - 1];
    if (!lastEl) return;
    lastEl.scrollIntoView({ block: "center", inline: "nearest" });
    snappedDefaultStepRef.current = true;
  }, [reduceMotion, steps.length]);

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;
    const els = stepRefs.current.filter(Boolean);
    if (!els.length) return undefined;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.12)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!hit) return;
        const idx = Number(hit.target.getAttribute("data-step-index"));
        if (Number.isFinite(idx)) setScrollStep(idx);
      },
      { root: null, rootMargin: "-36% 0px -36% 0px", threshold: [0, 0.12, 0.28, 0.45] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reduceMotion, steps.length]);

  useEffect(() => {
    if (!token || !mapContainerRef.current) return;
    setMapStyleReady(false);
    mapboxgl.accessToken = token;

    let cancelled = false;
    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetchCsv(dataAssetUrl("fy26_route_n_profiles_all.csv")),
      fetchCsv(dataAssetUrl("FY26_route_status_all.csv")),
      fetch(dataAssetUrl("route_lines_current.geojson"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([hoodGeo, hoodStats, routeStats, routeGeo]) => {
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
          pct_no_car: safeFloat(row.transit_dependent_pct_proxy),
          poverty_rate: safeFloat(row.below_poverty_pct),
          pct_transit_dependent: safeFloat(row.transit_dependent_pct_proxy),
          routes_cut_or_reduced: useStreet ? row.routes_losing_street || "" : row.routes_losing || "",
          pct_access_lost: routesBefore > 0 ? routesLosing / routesBefore : 0,
          access_metric: useStreet ? "street" : "all_stops",
        });
      });

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

      if (!routeGeo?.features?.length) {
        setRoutesFileMissing(true);
        return;
      }

      const storyFeatures = routeGeo.features
        .map((f) => {
          const rawId = String(f.properties?.route_id || f.properties?.route_code || "")
            .trim()
            .toUpperCase();
          const rid = normalizeRouteId(rawId);
          if (!STORY_ROUTES.has(rid)) return null;
          const found = routeById.get(rid);
          return {
            ...f,
            geometry: simplifyRouteGeometry(f.geometry, ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG * 1.25),
            properties: {
              ...f.properties,
              route_id: rid,
              route_name: found?.route_name || f.properties?.route_name || rid,
            },
          };
        })
        .filter(Boolean);

      if (!storyFeatures.length) {
        setRoutesFileMissing(true);
        return;
      }

      const touchedHoods = hoodNamesTouchingRoutes(storyFeatures, hoodGeo);

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
            on_corridor: touchedHoods.has(hood) ? 1 : 0,
            pct_no_car: m.pct_no_car ?? 0,
            poverty_rate: m.poverty_rate ?? 0,
            pct_transit_dependent: m.pct_transit_dependent ?? 0,
            routes_cut_or_reduced: m.routes_cut_or_reduced ?? "",
            pct_access_lost: m.pct_access_lost ?? 0,
            access_metric: m.access_metric ?? "all_stops",
            is_water: waterHeavy ? 1 : 0,
          },
        };
      });

      hoodGeo.features = hoodGeo.features.map((f) => {
        if (safeFloat(f.properties?.is_water) === 1) return f;
        try {
          const sf = simplify(clone(f), { tolerance: HOOD_SIMPLIFY_TOL, highQuality: true });
          return { ...sf, properties: f.properties };
        } catch {
          return f;
        }
      });

      const landFeat = hoodGeo.features.filter((f) => safeFloat(f.properties?.is_water) !== 1);
      const touchedFeat = landFeat.filter((f) => f.properties?.on_corridor === 1);
      const pCutsC = quartileUpperEdges(sortedProp(touchedFeat, "poverty_rate"));
      const tCutsC = quartileUpperEdges(sortedProp(touchedFeat, "pct_transit_dependent"));

      hoodGeo.features = hoodGeo.features.map((f) => {
        const p = safeFloat(f.properties?.poverty_rate);
        const t = safeFloat(f.properties?.pct_transit_dependent);
        return {
          ...f,
          properties: {
            ...f.properties,
            poverty_bin_c: binFromCuts(p, pCutsC),
            poverty_bin_r: binFromCuts(
              p,
              quartileUpperEdges(sortedProp(landFeat, "poverty_rate")),
            ),
            transit_bin_c: binFromCuts(t, tCutsC),
            transit_bin_r: binFromCuts(
              t,
              quartileUpperEdges(sortedProp(landFeat, "pct_transit_dependent")),
            ),
          },
        };
      });

      routeGeo.features = routeGeo.features.map((f) => {
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
      });

      hoodGeoRef.current = hoodGeo;

      const dotStacks = DOT_MAP_RESOLUTION_STEPS.map((step) =>
        buildCorridorScrollDotsGeojson(hoodGeo, { cellKm: step.cellKm }),
      );
      const lastCuts = dotStacks[dotStacks.length - 1];
      if (lastCuts?.tCutsC) {
        setTransitDotLegend(transitSizeLegendFromCuts(lastCuts.tCutsC));
      }

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: FLAT_BASEMAP_STYLE,
        center: MAP_CENTER,
        zoom: CORRIDOR_MAP_INITIAL_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
        interactive: true,
      });
      mapRef.current = map;

      const applyInteractionForPhase = (phase) => {
        const full = phase === "full";
        map.scrollZoom.enable();
        map.dragPan.enable();
        map.doubleClickZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (!full) {
          map.scrollZoom.disable();
          map.boxZoom.disable();
          map.keyboard.disable();
        }
      };

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("hoods", { type: "geojson", data: hoodGeo });

        const phaseAtLoad = steps[scrollStepRef.current]?.phase ?? "full";

        const initialFillColor =
          phaseAtLoad === "poverty" ? fillExprCorridorPoverty() : hoodFillNeutralLand();
        const initialFillOpacity = phaseAtLoad === "poverty" ? fillOpacityCorridor : fillOpacityNeutral;

        map.addLayer({
          id: "hood-fill-corridor",
          type: "fill",
          source: "hoods",
          paint: {
            "fill-color": initialFillColor,
            "fill-opacity": initialFillOpacity,
          },
        });

        map.addLayer({
          id: "hood-outline-corridor",
          type: "line",
          source: "hoods",
          filter: ["!=", ["to-number", ["get", "is_water"]], 1],
          paint: {
            "line-color": "#c4c2be",
            "line-width": 0.7,
            "line-opacity": 0.9,
          },
        });

        const dotsShownAtLoad = phaseAtLoad === "transit" || phaseAtLoad === "full";
        const dotColorAtLoad =
          phaseAtLoad === "transit" ? TRANSIT_DOT_NEUTRAL_GREY : povertyQuartileDotColorExpr();

        dotStacks.forEach((stack, i) => {
          const step = DOT_MAP_RESOLUTION_STEPS[i];
          map.addSource(`corridor-scroll-dots-${i}`, { type: "geojson", data: stack.dots });
          /** @type {import('mapbox-gl').AnyLayer} */
          const layer = {
            id: `corridor-scroll-dots-circle-${i}`,
            type: "circle",
            source: `corridor-scroll-dots-${i}`,
            paint: {
              "circle-color": dotColorAtLoad,
              "circle-radius": circleRadiusGroundMatchExpression(step.cellKm),
              "circle-opacity": 1,
              "circle-stroke-width": 0,
            },
            layout: { visibility: dotsShownAtLoad ? "visible" : "none" },
          };
          if (step.minZoom != null) layer.minzoom = step.minZoom;
          if (step.maxZoom != null) layer.maxzoom = step.maxZoom;
          map.addLayer(layer);
        });

        map.addLayer({
          id: "hood-hit-corridor",
          type: "fill",
          source: "hoods",
          filter: ["!=", ["to-number", ["get", "is_water"]], 1],
          paint: { "fill-opacity": 0 },
        });

        map.addSource("corridor-routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features: storyFeatures },
        });
        map.addLayer({
          id: "corridor-routes",
          type: "line",
          source: "corridor-routes",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": CORRIDOR_ROUTE_LINE_WIDTH,
            "line-opacity": 1,
            "line-color": [
              "match",
              ["get", "route_id"],
              "71B",
              ROUTE_71B_BLUE,
              "P10",
              ROUTE_P10_CORAL,
              "#64748b",
            ],
          },
        });

        map.addSource("routes", { type: "geojson", data: routeGeo });
        map.addLayer({
          id: "routes-after-eliminated",
          type: "line",
          source: "routes",
          filter: ["==", ["get", "route_visual"], ROUTE_VISUAL.elimination],
          paint: ROUTES_ELIMINATED_PAINT,
          layout: { visibility: "none" },
        });
        map.addLayer({
          id: "routes-after",
          type: "line",
          source: "routes",
          filter: ["!=", ["get", "route_visual"], ROUTE_VISUAL.elimination],
          paint: ROUTES_AFTER_DETAILED_PAINT,
          layout: { visibility: "none" },
        });

        map.setPaintProperty("routes-after", "line-width", REGIONAL_ROUTE_LINE_WIDTH);
        map.setPaintProperty("routes-after-eliminated", "line-width", REGIONAL_ROUTE_LINE_WIDTH);

        map.addLayer({
          id: "hood-hover-outline",
          type: "line",
          source: "hoods",
          filter: ["==", ["get", "neighborhood_name"], ""],
          paint: {
            "line-color": "#111",
            "line-width": 1.4,
          },
        });

        applyInteractionForPhase(phaseAtLoad);

        map.on("mousemove", "hood-hit-corridor", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const p = feature.properties || {};
          setHoverData({
            name: p.neighborhood_name,
            pctWorkersTransitCommute: safeFloat(p.pct_no_car),
            povertyRate: safeFloat(p.poverty_rate),
            routesCut: p.routes_cut_or_reduced,
            pctAccessLost: safeFloat(p.pct_access_lost),
            accessMetric: p.access_metric === "street" ? "street" : "all_stops",
            onCorridor: p.on_corridor === 1,
          });
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], p.neighborhood_name]);
        });

        map.on("mouseleave", "hood-hit-corridor", () => {
          setHoverData(null);
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
        });

        setMapStyleReady(true);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token, steps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapStyleReady || !map?.isStyleLoaded() || !map.getLayer("hood-fill-corridor")) return;

    const regional = activePhase === "full" && showFullEquityMap;

    if (activePhase === "poverty") {
      map.setPaintProperty("hood-fill-corridor", "fill-color", fillExprCorridorPoverty());
      map.setPaintProperty("hood-fill-corridor", "fill-opacity", fillOpacityCorridor);
    } else {
      map.setPaintProperty("hood-fill-corridor", "fill-color", hoodFillNeutralLand());
      map.setPaintProperty("hood-fill-corridor", "fill-opacity", fillOpacityNeutral);
    }

    const dotsVisible = activePhase === "transit" || activePhase === "full";
    const colorExpr = activePhase === "transit" ? TRANSIT_DOT_NEUTRAL_GREY : povertyQuartileDotColorExpr();

    for (let i = 0; i < DOT_MAP_RESOLUTION_STEPS.length; i++) {
      const id = `corridor-scroll-dots-circle-${i}`;
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", dotsVisible ? "visible" : "none");
        map.setPaintProperty(id, "circle-color", colorExpr);
      }
    }

    const routeVis = regional ? "visible" : "none";
    const corridorRouteVis = regional ? "none" : "visible";
    if (map.getLayer("corridor-routes")) {
      map.setLayoutProperty("corridor-routes", "visibility", corridorRouteVis);
    }
    if (map.getLayer("routes-after-eliminated")) {
      map.setLayoutProperty("routes-after-eliminated", "visibility", routeVis);
    }
    if (map.getLayer("routes-after")) {
      map.setLayoutProperty("routes-after", "visibility", routeVis);
    }

    const full = activePhase === "full";
    if (full) {
      map.scrollZoom.enable();
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      map.keyboard.enable();
    } else {
      map.scrollZoom.disable();
      map.dragPan.enable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
      map.keyboard.disable();
    }
  }, [mapStyleReady, activePhase, showFullEquityMap]);

  const applyCorridorHomeCamera = useCallback(() => {
    const map = mapRef.current;
    const hoodGeo = hoodGeoRef.current;
    if (!mapStyleReady || !map?.isStyleLoaded()) return;

    const gen = ++corridorFitGenerationRef.current;
    const regional = activePhase === "full" && showFullEquityMap;

    const syncIfCurrent = () => {
      if (corridorFitGenerationRef.current !== gen || mapRef.current !== map || !map.isStyleLoaded()) return;
      map.setMinZoom(map.getZoom());
    };

    /** @type {number[] | null} */
    let b = null;
    try {
      /*
       * Frame to land neighborhood polygons only (same extent as the grey plate: off-corridor muted +
       * neutral `DOT_MAP_REGION_FILL` land), not route lines or a corridor-only subset.
       */
      const landHoods =
        hoodGeo?.features?.filter((f) => Number(f.properties?.is_water) !== 1) ?? [];
      if (landHoods.length) {
        b = turf.bbox({ type: "FeatureCollection", features: landHoods });
      }
      if (b?.every(Number.isFinite)) {
        const duration = reduceMotion ? 0 : 480;
        map.fitBounds(
          [
            [b[0], b[1]],
            [b[2], b[3]],
          ],
          {
            padding: regional
              ? { top: 40, bottom: 44, left: 40, right: 40 }
              : { top: 24, bottom: 28, left: 20, right: 20 },
            duration,
            maxZoom: regional ? 10.9 : 12.65,
          },
        );
        map.once("moveend", syncIfCurrent);
        if (duration === 0) {
          requestAnimationFrame(syncIfCurrent);
        }
      } else {
        syncIfCurrent();
      }
    } catch {
      /* no-op */
    }
  }, [mapStyleReady, activePhase, showFullEquityMap, reduceMotion]);

  useEffect(() => {
    applyCorridorHomeCamera();
  }, [applyCorridorHomeCamera]);

  const legendRegionalTransit = copy.legendRegionalTransit ?? copy.legendTransit;

  let legendText = copy.legendFull;
  if (regionalEquityOn) {
    legendText = copy.legendRegional;
  } else if (activePhase === "poverty") {
    legendText = copy.legendPoverty;
  } else if (activePhase === "transit") {
    legendText = transitDotLegend
      ? `${copy.legendTransit}\n\n${transitDotLegend.caption}`
      : copy.legendTransit;
  } else if (activePhase === "full") {
    legendText = copy.legendFull;
  }

  const sectionTitleVis = String(sectionTitle ?? "").trim();

  if (!token) {
    return (
      <section className={sdStyles.wrap} aria-label="Corridor map">
        <p className={localStyles.tokenMissing}>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to render the map.
        </p>
      </section>
    );
  }

  return (
    <section className={sdStyles.wrap} aria-labelledby="corridor-scroll-map-title">
      <header className={sdStyles.head}>
        <h2
          id="corridor-scroll-map-title"
          className={sectionTitleVis ? sdStyles.leadTitle : "sr-only"}
        >
          {sectionTitleVis || "71B and P10 on the map"}
        </h2>
        {sectionIntro?.trim() ? <p className={sdStyles.leadBody}>{sectionIntro}</p> : null}
      </header>

      <div className={`${sdStyles.shell} ${localStyles.corridorShell}`}>
        <div className={`${sdStyles.sticky} ${localStyles.corridorSticky}`}>
          <figure className={sdStyles.figure} aria-label="71B and P10 corridor map">
            <div className={localStyles.mapWrap}>
              <div ref={mapContainerRef} className={localStyles.mapInner} />
              <button
                type="button"
                className={localStyles.mapRecenter}
                onClick={applyCorridorHomeCamera}
                disabled={!mapStyleReady}
                aria-label="Recenter map on the current corridor or regional extent"
              >
                Recenter map
              </button>
            </div>
            {activePhase === "full" ? (
              <div className={localStyles.fullControls}>
                <div className={localStyles.fullToggleRow}>
                  <label className={localStyles.toggle}>
                    <input
                      type="checkbox"
                      checked={showFullEquityMap}
                      onChange={(e) => setShowFullEquityMap(e.target.checked)}
                    />
                    <span>{copy.fullEquityToggleLabel}</span>
                  </label>
                </div>
              </div>
            ) : null}
            <div className={sdStyles.legend} role="note">
              {legendText}
            </div>
            {reduceMotion ? (
              <p className={sdStyles.motionNote}>
                {reducedMotionNote ?? scrollDemographicsNarrative.ui.reducedMotionNote}
              </p>
            ) : null}
            <div className={sdStyles.sourceRow}>
              <span className={sdStyles.sourceLabel}>Sources & methods</span>
              <DataRationaleIcon
                label="Data sources for corridor map"
                rationale={`${copy.legendPoverty}\n\n${copy.legendTransit}\n\n${copy.legendFull}\n\n${copy.legendRegional}\n\n${legendRegionalTransit}\n\n${scrollDemographicsNarrative.ui.sourceNote}${copy.methodNoteBrt?.trim() ? `\n\n${copy.methodNoteBrt.trim()}` : ""}`}
              />
            </div>
            {hoverData ? (
              <div className={localStyles.hoverReadout}>
                <dl>
                  <dt>Neighborhood</dt>
                  <dd>{hoverData.name}</dd>
                  <dt>{regionalEquityOn ? "Story lines" : "Corridor"}</dt>
                  <dd>
                    {regionalEquityOn
                      ? hoverData.onCorridor
                        ? "Touches 71B / P10"
                        : "Other area"
                      : hoverData.onCorridor
                        ? "On 71B / P10"
                        : "Off corridor (muted)"}
                  </dd>
                  <dt>Poverty</dt>
                  <dd>{(hoverData.povertyRate * 100).toFixed(1)}%</dd>
                  <dt>Transit commute</dt>
                  <dd>{(hoverData.pctWorkersTransitCommute * 100).toFixed(1)}%</dd>
                </dl>
              </div>
            ) : null}
            {routesFileMissing ? (
              <p className={sdStyles.motionNote}>
                Map needs <code>route_lines_current.geojson</code> with <code>71B</code> and <code>P10</code>{" "}
                route features.
              </p>
            ) : null}
          </figure>
        </div>

        <div className={sdStyles.steps}>
          {steps.map((s, i) => (
            <article
              key={s.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              data-step-index={i}
              className={`${sdStyles.step} ${!reduceMotion && effectiveStep === i ? sdStyles.stepActive : ""}`}
            >
              <div className={sdStyles.stepIndex}>
                {i + 1} / {steps.length}
              </div>
              <h3 className={sdStyles.stepTitle}>{s.title}</h3>
              {s.body?.trim() ? (
                <p className={`${sdStyles.stepBody} ${localStyles.stepBodyBullets}`}>{s.body}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
