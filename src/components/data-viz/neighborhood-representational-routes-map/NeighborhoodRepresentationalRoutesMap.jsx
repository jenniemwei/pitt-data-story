"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import { bearing, centroid, destination, distance, midpoint, point } from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNeighborhoodPanel } from "../../../contexts/NeighborhoodPanelContext";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import { restrictMapboxFreeformZoom } from "../../../lib/mapboxRestrictZoom";
import {
  buildHoverPayloadForNeighborhoodName,
  mergeDisplayAndNProfiles,
  normalizeStatus,
  parseRouteList,
} from "../../../lib/neighborhoodPanelPayload";
import styles from "./NeighborhoodRepresentationalRoutesMap.module.css";

const FLAT_BASEMAP_STYLE = {
  version: 8,
  name: "representational-flat",
  metadata: { "mapbox:autocomposite": false },
  sources: {},
  layers: [{ id: "basemap-flat", type: "background", paint: { "background-color": "#f7f7f7" } }],
};

const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.35;

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

function buildProfileToHoods(displayRows, hoodSet) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  for (const row of displayRows) {
    const profile = String(row.profile_neighborhood_group || "").trim();
    const ng = String(row.neighborhood_group || "").trim();
    if (!profile || !ng || !hoodSet.has(ng)) continue;
    if (!map.has(profile)) map.set(profile, []);
    map.get(profile).push(ng);
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
 * Compound labels match `profile_neighborhood_group` in neighborhood_display_profiles.csv.
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
    map.fitBounds(bounds, { padding: 56, maxZoom: 11.4, duration: 0 });
  }
}

function getCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** @param {import('mapbox-gl').Map} map */
function applyRepresentationalRouteLineStyle(map, mode) {
  if (!map.getLayer("rep-route-lines-layer")) return;
  const lineDefault = getCssVar("--color-line-default", "#134948");
  const lineReduced = getCssVar("--color-line-reduced1", "#82B6B5");
  if (mode === "before") {
    map.setPaintProperty("rep-route-lines-layer", "line-color", lineDefault);
    map.setPaintProperty("rep-route-lines-layer", "line-opacity", 1);
  } else {
    map.setPaintProperty("rep-route-lines-layer", "line-color", [
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
    map.setPaintProperty("rep-route-lines-layer", "line-opacity", [
      "match",
      ["get", "route_status"],
      "unchanged",
      1,
      "reduced",
      1,
      "eliminated",
      0,
      1,
    ]);
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
      fetch(dataAssetUrl("neighborhood_display_profiles.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("n_profiles_new.csv"))
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
    ]).then(([hoodGeo, fy26Raw, displayRaw, nProfRaw, nProfilesNewRaw]) => {
      if (cancelled || !containerRef.current) return;

      const fy26Rows = parseCsv(fy26Raw);
      const displayRows = parseCsv(displayRaw);
      const nProfRows = parseCsv(nProfRaw);
      const nProfileRows = nProfilesNewRaw ? parseCsv(nProfilesNewRaw) : [];
      const nHoodOnly = nProfileRows.filter(
        (r) => String(r.geography_type || "").toLowerCase() === "neighborhood",
      );
      const profilesByHood = mergeDisplayAndNProfiles(displayRows, nHoodOnly);

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

      hoverPanelDataRef.current = {
        routesByNeighborhood,
        statusByRoute,
        reductionTierByRoute,
        profilesByHood,
      };

      const hoodSet = new Set();
      /** @type {Map<string, [number, number]>} */
      const centroids = new Map();
      for (const f of hoodGeo.features || []) {
        const hood = String(f.properties?.hood || "").trim();
        if (!hood) continue;
        hoodSet.add(hood);
        centroids.set(hood, centroid(f).geometry.coordinates);
      }

      const profileToHoods = buildProfileToHoods(displayRows, hoodSet);

      const popByHood = new Map();
      const povByHood = new Map();
      for (const row of nProfRows) {
        const n = String(row.neighborhood || "").trim();
        if (!n) continue;
        popByHood.set(n, num(row.population_total, 0));
        povByHood.set(n, normalizePovertyRatio(row.below_poverty_pct));
      }

      const pops = [...popByHood.values()].filter((p) => p > 0);
      const minPop = pops.length ? Math.min(...pops) : 1;
      const maxPop = pops.length ? Math.max(...pops) : minPop + 1;
      const sqrtMin = Math.sqrt(Math.max(minPop, 1));
      const sqrtMax = Math.sqrt(Math.max(maxPop, 1));

      /** @type {GeoJSON.Feature[]} */
      const pointFeatures = [];
      for (const hood of hoodSet) {
        const c = centroids.get(hood);
        if (!c) continue;
        pointFeatures.push({
          type: "Feature",
          properties: {
            neighborhood_name: hood,
            population: popByHood.get(hood) ?? 0,
            poverty: povByHood.get(hood) ?? 0,
          },
          geometry: { type: "Point", coordinates: c },
        });
      }

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

        for (let i = 0; i < chain.length - 1; i += 1) {
          const a = chain[i];
          const b = chain[i + 1];
          const p0 = centroids.get(a);
          const p2 = centroids.get(b);
          if (!p0 || !p2) continue;

          const pairKey = [a, b].sort().join("\0");
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
        zoom: MAP_INITIAL_ZOOM,
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
              "interpolate",
              ["linear"],
              ["^", ["max", ["get", "population"], 1], 0.5],
              sqrtMin,
              4,
              sqrtMax,
              26,
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
          const { routesByNeighborhood: rbn, statusByRoute: sbr, reductionTierByRoute: rtr, profilesByHood: pbh } =
            hoverPanelDataRef.current;
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
            Circle area reflects population from neighborhood profiles.
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
          Each point is a neighborhood centroid; circle size scales with total population. Curved gray segments link
          consecutive neighborhoods in the FY26 published anchor order (including expanded compound anchors), so
          overlapping routes fan apart slightly—this is a schematic, not a geographic trace of streets.
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
