"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import { bearing, centroid, destination, distance, midpoint, point } from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNeighborhoodPanel } from "../../contexts/NeighborhoodPanelContext";
import { normalizeRouteId } from "../../lib/equity-map/constants";
import { dataAssetUrl } from "../../lib/dataAssetUrl";
import { restrictMapboxFreeformZoom } from "../../lib/mapboxRestrictZoom";
import {
  buildHoverPayloadForNeighborhoodName,
  mergeDisplayAndNProfiles,
  normalizeStatus,
  parseRouteList,
} from "../../lib/neighborhoodPanelPayload";
import {
  addGroupKeysToRoutesMap,
  buildHoodToGroupNameMap,
  buildRepresentationalGroupPointFeatures,
} from "../../lib/coverageHoodGroups";
import styles from "./RouteWeb.module.css";

const FLAT_BASEMAP_STYLE = {
  version: 8,
  name: "representational-flat",
  metadata: { "mapbox:autocomposite": false },
  sources: {},
  layers: [{ id: "basemap-flat", type: "background", paint: { "background-color": "#f7f7f7" } }],
};

const MAP_CENTER = [-79.9959, 40.4406];
/** Match `CoverageMap` initial view (see `MAP_INITIAL_ZOOM` + 0.45 there). */
const MAP_INITIAL_ZOOM = 10.1;

/**
 * `n_crosswalk` / FY26 anchor group for downtown core (CBD ± Crawford-Roberts).
 * Anchor CSV sometimes uses the short "Central Business District" token alone.
 * @param {string | undefined} rep
 */
function isDowntownGroupRep(rep) {
  if (!rep) return false;
  const s = String(rep).trim();
  return s === "Central Business District" || s === "Central Business District - Crawford Roberts";
}

/** @param {string[]} chain Hood names in FY26 order; getRepName maps block hood → group label. */
function chainTouchesDowntownGroup(chain, getRepName) {
  return chain.some((h) => isDowntownGroupRep(getRepName(h)));
}

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePovertyRatio(raw) {
  const n = num(raw, NaN);
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function dedupeConsecutive(names) {
  const out = [];
  for (const x of names) {
    if (out[out.length - 1] !== x) out.push(x);
  }
  return out;
}

function buildProfileToHoods(displayRows, hoodSet, hoodToGroup) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  for (const row of displayRows) {
    const profile = String(row.profile_neighborhood_group || "").trim();
    if (profile && !map.has(profile)) map.set(profile, []);
  }
  for (const hood of hoodSet) {
    const profile = hoodToGroup.get(hood) || hood;
    if (!map.has(profile)) map.set(profile, []);
    const bucket = map.get(profile);
    if (!bucket.includes(hood)) bucket.push(hood);
  }
  return map;
}

function expandAnchorToken(token, hoodSet, profileToHoods) {
  if (hoodSet.has(token)) return [token];
  const list = profileToHoods.get(token);
  return list ? [...list] : [];
}

function averageCoord(hoods, centroids) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const h of hoods) {
    const c = centroids.get(h);
    if (!c) continue;
    sx += c[0];
    sy += c[1];
    n += 1;
  }
  if (!n) return MAP_CENTER;
  return [sx / n, sy / n];
}

function orderHoodsByProximity(hoods, centroids, fromLngLat) {
  if (hoods.length <= 1) return hoods;
  const remaining = new Set(hoods);
  /** @type {string[]} */
  const ordered = [];
  let cur = fromLngLat;
  while (remaining.size) {
    let best = null;
    let bestD = Infinity;
    for (const h of remaining) {
      const c = centroids.get(h);
      if (!c) continue;
      const d = distance(point(cur), point(c), { units: "kilometers" });
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    if (!best) break;
    remaining.delete(best);
    ordered.push(best);
    cur = centroids.get(best);
  }
  return ordered;
}

/**
 * FY26 `anchor_neighborhoods` is an ordered comma-separated list (along the corridor).
 * Compound labels match `profile_neighborhood_group` in display_profiles_2024.csv.
 */
function buildHoodChain(anchorStr, hoodSet, profileToHoods, centroids) {
  const rawParts = String(anchorStr || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!rawParts.length || rawParts[0].toLowerCase().startsWith("none")) return [];

  /** @type {string[]} */
  const chain = [];
  let prevEnd = null;

  for (const tok of rawParts) {
    let hoods = expandAnchorToken(tok, hoodSet, profileToHoods);
    if (!hoods.length) continue;

    if (hoods.length > 1) {
      const seed = prevEnd || averageCoord(hoods, centroids);
      hoods = orderHoodsByProximity(hoods, centroids, seed);
    }

    for (const h of hoods) chain.push(h);
    const last = chain[chain.length - 1];
    prevEnd = centroids.get(last) || prevEnd;
  }

  return dedupeConsecutive(chain);
}

function quadraticCoord(p0, ctrl, p2, t) {
  const u = 1 - t;
  return [
    u * u * p0[0] + 2 * u * t * ctrl[0] + t * t * p2[0],
    u * u * p0[1] + 2 * u * t * ctrl[1] + t * t * p2[1],
  ];
}

function bezierLineCoordinates(p0, p2, bendSign, offsetKm) {
  const pt0 = point(p0);
  const pt2 = point(p2);
  const mid = midpoint(pt0, pt2);
  const brg = bearing(pt0, pt2);
  const ctrl = destination(mid, offsetKm, brg + 90 * bendSign, { units: "kilometers" }).geometry.coordinates;
  const steps = 20;
  /** @type {[number, number][]} */
  const coords = [];
  for (let i = 0; i <= steps; i += 1) {
    coords.push(quadraticCoord(p0, ctrl, p2, i / steps));
  }
  return coords;
}

function extendBoundsForCoords(bounds, coords) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds.extend(coords);
    return;
  }
  for (const child of coords) {
    extendBoundsForCoords(bounds, child);
  }
}

function fitToLineAndPoints(map, lineFc, pointFc) {
  const bounds = new mapboxgl.LngLatBounds();
  for (const f of lineFc.features || []) {
    extendBoundsForCoords(bounds, f?.geometry?.coordinates);
  }
  for (const f of pointFc.features || []) {
    extendBoundsForCoords(bounds, f?.geometry?.coordinates);
  }
  if (!bounds.isEmpty()) {
    const pad = Number.parseInt(getCssVar("--spacing-p-lg", "48"), 10);
    const padding = Number.isFinite(pad) && pad > 0 ? pad : 48;
    map.fitBounds(bounds, {
      padding,
      maxZoom: 12.5,
      duration: 0,
    });
  }
}

function getCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * `line-opacity` in **after** mode for all `route_status: reduced` segments (solid lines, no dashing).
 */
const REDUCED_LINE_OPACITY = 0.5;

/** @param {import('mapbox-gl').Map} map */
function applyRepresentationalRouteLineStyle(map, mode) {
  if (!map.getLayer("rep-route-lines-layer")) return;
  const lineW2 = Number.parseFloat(getCssVar("--width-2", "0.5")) || 0.5;
  const lineW3 = Number.parseFloat(getCssVar("--width-3", "1")) || 1;
  const lineWidthExpr = /** @type {import("mapbox-gl").DataDrivenPropertyValueSpecification<number>} */ ([
    "case",
    ["==", ["get", "downtown_route"], 1],
    lineW3,
    lineW2,
  ]);
  const lineDefault = getCssVar("--color-line-default", "#134948");
  const lineReduced = getCssVar("--color-line-reduced2", "#82B6B5");
  const colorAfter = /** @type {import("mapbox-gl").DataDrivenPropertyValueSpecification<string>} */ ([
    "match",
    ["get", "route_status"],
    "unchanged",
    lineDefault,
    "reduced",
    lineReduced,
    "eliminated",
    lineDefault,
    lineDefault,
  ]);
  const opacityAfter = /** @type {import("mapbox-gl").DataDrivenPropertyValueSpecification<number>} */ ([
    "case",
    ["==", ["get", "route_status"], "eliminated"],
    0,
    ["==", ["get", "route_status"], "reduced"],
    REDUCED_LINE_OPACITY,
    1,
  ]);

  map.setPaintProperty("rep-route-lines-layer", "line-width", lineWidthExpr);
  if (mode === "before") {
    map.setPaintProperty("rep-route-lines-layer", "line-color", lineDefault);
    map.setPaintProperty("rep-route-lines-layer", "line-opacity", 1);
  } else {
    map.setPaintProperty("rep-route-lines-layer", "line-color", colorAfter);
    map.setPaintProperty("rep-route-lines-layer", "line-opacity", opacityAfter);
  }
}

export default function NeighborhoodRepresentationalRoutesMap() {
  const { setRepresentationalHoverPanel } = useNeighborhoodPanel();
  const setReprHoverRef = useRef(setRepresentationalHoverPanel);

  const hoverPanelDataRef = useRef({
    routesByNeighborhood: new Map(),
    statusByRoute: new Map(),
    reductionTierByRoute: new Map(),
    profilesByHood: new Map(),
  });

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const lineFcRef = useRef(null);
  const pointFcRef = useRef(null);
  const routeViewRef = useRef("before");
  const [routeView, setRouteView] = useState("before");
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  useEffect(() => {
    routeViewRef.current = routeView;
  }, [routeView]);

  useEffect(() => {
    setReprHoverRef.current = setRepresentationalHoverPanel;
  }, [setRepresentationalHoverPanel]);

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    const lines = lineFcRef.current;
    const pts = pointFcRef.current;
    if (map && lines && pts) fitToLineAndPoints(map, lines, pts);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer?.("rep-route-lines-layer")) return;
    applyRepresentationalRouteLineStyle(map, routeView);
  }, [routeView]);

  useEffect(() => {
    if (!token || !containerRef.current) return undefined;

    mapboxgl.accessToken = token;
    let cancelled = false;
    /** @type {mapboxgl.Map | null} */
    let mapInstance = null;
    const onResize = () => {
      if (mapInstance) mapInstance.resize();
    };
    let resizeObserver = null;

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetch(dataAssetUrl("FY26_route_status_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("display_profiles_2024.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
    ]).then(([hoodGeo, fy26Raw, displayRaw, nProfRaw]) => {
      if (cancelled || !containerRef.current) return;

      const fy26Rows = parseCsv(fy26Raw);
      const displayRows = parseCsv(displayRaw);
      const nProfRows = parseCsv(nProfRaw);
      const profilesByHood = mergeDisplayAndNProfiles(displayRows);
      const hoodSet = new Set(
        (hoodGeo.features || [])
          .map((f) => String(f?.properties?.hood || "").trim())
          .filter(Boolean),
      );
      const hoodToGroup = buildHoodToGroupNameMap(displayRows, hoodSet);

      const statusByRoute = new Map();
      const reductionTierByRoute = new Map();
      for (const row of fy26Rows) {
        const routeId = normalizeRouteId(row.route_code || row.route_label || "");
        if (!routeId) continue;
        statusByRoute.set(routeId, normalizeStatus(row.route_status));
        reductionTierByRoute.set(routeId, row.reduction_tier);
      }

      const routesByNeighborhood = new Map();
      for (const row of nProfRows) {
        const neighborhood = String(row.neighborhood || row.hood || "").trim();
        if (!neighborhood) continue;
        if (!routesByNeighborhood.has(neighborhood)) routesByNeighborhood.set(neighborhood, new Set());
        const routes = parseRouteList(row.routes_before);
        for (const routeId of routes) {
          routesByNeighborhood.get(neighborhood).add(routeId);
        }
      }
      addGroupKeysToRoutesMap(routesByNeighborhood, hoodToGroup);

      hoverPanelDataRef.current = {
        routesByNeighborhood,
        statusByRoute,
        reductionTierByRoute,
        profilesByHood,
      };

      /** @type {Map<string, [number, number]>} */
      const centroids = new Map();
      for (const f of hoodGeo.features || []) {
        const hood = String(f.properties?.hood || "").trim();
        if (!hood) continue;
        hoodSet.add(hood);
        centroids.set(hood, centroid(f).geometry.coordinates);
      }

      const profileToHoods = buildProfileToHoods(displayRows, hoodSet, hoodToGroup);

      const popByHood = new Map();
      const povByHood = new Map();
      for (const row of nProfRows) {
        const n = String(row.neighborhood || "").trim();
        if (!n) continue;
        popByHood.set(n, num(row.population_total, 0));
        povByHood.set(n, normalizePovertyRatio(row.below_poverty_pct));
      }

      /** @type {GeoJSON.Feature[]} */
      const pointFeatures = buildRepresentationalGroupPointFeatures(
        hoodSet,
        centroids,
        popByHood,
        povByHood,
        hoodToGroup,
      );
      /** One schematic dot per group (or stand-alone hood) — line endpoints must use these, not per-hood centroids. */
      const repCoordByName = new Map();
      for (const f of pointFeatures) {
        const n = f.properties?.neighborhood_name;
        if (n == null || f.geometry?.type !== "Point") continue;
        repCoordByName.set(String(n).trim(), f.geometry.coordinates);
      }
      const getRepName = (hood) => hoodToGroup.get(hood) || hood;

      const pops = pointFeatures.map((f) => num(f.properties?.population, 0)).filter((p) => p > 0);
      const maxPop = pops.length ? Math.max(...pops) : 1;

      /** @type {Map<string, number>} */
      const pairArcIndex = new Map();

      /** @type {GeoJSON.Feature[]} */
      const lineFeatures = [];

      for (const row of fy26Rows) {
        const routeId = normalizeRouteId(row.route_code || row.route_label || "");
        if (!routeId) continue;
        const routeStatus = normalizeStatus(row.route_status);
        const chain = buildHoodChain(row.anchor_neighborhoods, hoodSet, profileToHoods, centroids);
        if (chain.length < 2) continue;

        const routeTouchesDowntown = chainTouchesDowntownGroup(chain, getRepName) ? 1 : 0;

        for (let i = 0; i < chain.length - 1; i += 1) {
          const a = chain[i];
          const b = chain[i + 1];
          const repA = getRepName(a);
          const repB = getRepName(b);
          if (repA === repB) continue;
          const p0 = repCoordByName.get(repA);
          const p2 = repCoordByName.get(repB);
          if (!p0 || !p2) continue;

          const pairKey = [repA, repB].sort().join("\0");
          const arcN = pairArcIndex.get(pairKey) || 0;
          pairArcIndex.set(pairKey, arcN + 1);
          const bendSign = arcN % 2 === 0 ? 1 : -1;
          const offsetKm = 0.1 + (arcN % 6) * 0.055;

          lineFeatures.push({
            type: "Feature",
            properties: {
              route_id: routeId,
              route_status: routeStatus,
              from_hood: a,
              to_hood: b,
              from_rep: repA,
              to_rep: repB,
              downtown_route: routeTouchesDowntown,
            },
            geometry: {
              type: "LineString",
              coordinates: bezierLineCoordinates(p0, p2, bendSign, offsetKm),
            },
          });
        }
      }

      const lineFc = { type: "FeatureCollection", features: lineFeatures };
      const pointFc = { type: "FeatureCollection", features: pointFeatures };
      lineFcRef.current = lineFc;
      pointFcRef.current = pointFc;

      const pageBg = getCssVar("--color-bg-default", "#f7f7f7");

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: {
          ...FLAT_BASEMAP_STYLE,
          layers: FLAT_BASEMAP_STYLE.layers.map((layer) =>
            layer.id === "basemap-flat"
              ? { ...layer, paint: { ...(layer.paint || {}), "background-color": pageBg } }
              : layer,
          ),
        },
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM + 0.45,
        attributionControl: true,
      });
      mapRef.current = map;
      mapInstance = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      restrictMapboxFreeformZoom(map);

      map.on("load", () => {
        const lineDefault = getCssVar("--color-line-default", "#134948");
        const lineW = Number.parseFloat(getCssVar("--width-2", "1")) || 0.85;
        const pov0 = getCssVar("--color-fill-positive", "#bfd0aa");
        const pov1 = getCssVar("--color-fill-neutral", "#c5b491");
        const pov2 = getCssVar("--color-fill-neg1", "#ffa883");
        const pov3 = getCssVar("--color-fill-neg2", "#d85c4d");
        map.addSource("rep-route-lines", { type: "geojson", data: lineFc });
        map.addLayer({
          id: "rep-route-lines-layer",
          type: "line",
          source: "rep-route-lines",
          paint: {
            "line-color": lineDefault,
            "line-width": lineW,
            "line-opacity": 1,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
        applyRepresentationalRouteLineStyle(map, routeViewRef.current);

        map.addSource("rep-hood-points", { type: "geojson", data: pointFc, promoteId: "neighborhood_name" });
        map.addLayer({
          id: "rep-hood-circles",
          type: "circle",
          source: "rep-hood-points",
          paint: {
            "circle-radius": [
              "max",
              4,
              [
                "min",
                52,
                ["/", ["*", 52, ["max", ["get", "population"], 1]], Math.max(maxPop, 1)],
              ],
            ],
            "circle-color": [
              "interpolate",
              ["linear"],
              ["get", "poverty"],
              0,
              pov0,
              0.12,
              pov1,
              0.22,
              pov2,
              0.35,
              pov3,
            ],
            "circle-stroke-width": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              2,
              0,
            ],
            "circle-stroke-color": "rgba(0,0,0,0.3)",
            "circle-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.86, 0.92],
          },
        });

        let hoveredRepHood = null;
        const onHoodEnter = (e) => {
          const f = e.features?.[0];
          if (!f?.geometry || f.geometry.type !== "Point") return;
          map.getCanvas().style.cursor = "pointer";
          const name = String(f.properties?.neighborhood_name || "").trim();
          if (!name) return;
          if (name !== hoveredRepHood) {
            if (hoveredRepHood) {
              try {
                map.setFeatureState(
                  { source: "rep-hood-points", id: hoveredRepHood },
                  { hover: false },
                );
              } catch {
                /* ignore */
              }
            }
            hoveredRepHood = name;
            try {
              map.setFeatureState({ source: "rep-hood-points", id: name }, { hover: true });
            } catch {
              /* ignore */
            }
          }
          const {
            routesByNeighborhood: rbn,
            statusByRoute: sbr,
            reductionTierByRoute: rtr,
            profilesByHood: pbh,
          } = hoverPanelDataRef.current;
          const payload = buildHoverPayloadForNeighborhoodName(name, rbn, sbr, rtr, pbh);
          setReprHoverRef.current(payload);
        };
        const onHoodLeave = () => {
          if (hoveredRepHood) {
            try {
              map.setFeatureState(
                { source: "rep-hood-points", id: hoveredRepHood },
                { hover: false },
              );
            } catch {
              /* ignore */
            }
            hoveredRepHood = null;
          }
          map.getCanvas().style.cursor = "";
          setReprHoverRef.current(null);
        };

        map.on("mouseenter", "rep-hood-circles", onHoodEnter);
        map.on("mouseleave", "rep-hood-circles", onHoodLeave);

        fitToLineAndPoints(map, lineFc, pointFc);
      });

      window.addEventListener("resize", onResize);
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(containerRef.current);
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      resizeObserver?.disconnect();
      setReprHoverRef.current(null);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      mapInstance = null;
      lineFcRef.current = null;
      pointFcRef.current = null;
    };
  }, [token]);

  if (!token) {
    return (
      <section className={styles.section} aria-label="Representational route map">
        <div className={styles.inner}>
          <h2 className={styles.title}>Neighborhoods and corridor anchors</h2>
          <p className={styles.lede}>
            Schematic arcs connect consecutive FY26 anchor neighborhoods along each route (not the real street path).
            Circle radius is proportional to population (doubling the population doubles the circle size).
          </p>
          <div className={styles.tokenMissing}>
            Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to view this map (same token as the coverage map above).
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-label="Representational route map">
      <div className={styles.inner}>
        <h2 className={styles.title}>Neighborhoods and corridor anchors</h2>
        <p className={styles.lede}>
          Each point is one neighborhood, or one merged point for a hyphenated neighborhood group; position is the
          average of member centroids. Circle radius is proportional to population. Curved gray segments link consecutive
          anchor positions in the FY26 published order (including expanded compound anchors), so overlapping routes
          fan apart slightly—this is a schematic, not a geographic trace of streets.
        </p>
      </div>
      <div className={styles.mapWrap}>
        <div ref={containerRef} className={styles.map} role="presentation" />
        <div className={styles.mapControls}>
          <div className={styles.mapOverlay} role="group" aria-label="Route scenario">
            <button
              type="button"
              className={`${styles.modeLink} ${routeView === "before" ? styles.modeLinkOn : ""}`}
              onClick={() => setRouteView("before")}
            >
              Before
            </button>
            <span className={styles.modeSep} aria-hidden>
              |
            </span>
            <button
              type="button"
              className={`${styles.modeLink} ${routeView === "after" ? styles.modeLinkOn : ""}`}
              onClick={() => setRouteView("after")}
            >
              After
            </button>
          </div>
          <button type="button" className={styles.recenterBtn} onClick={recenterMap}>
            Re-center map
          </button>
        </div>
      </div>
    </section>
  );
}
