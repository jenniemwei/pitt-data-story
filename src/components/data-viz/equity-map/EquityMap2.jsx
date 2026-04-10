"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import { rowServesP10Or71B } from "../../../lib/equity-map/equityMap2RouteHoods";
import { buildEquityMap2Data, EQUITY_MAP2_POVERTY_COLORS } from "../../../lib/equity-map/buildEquityMap2Dots";
import {
  ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG,
  simplifyRouteGeometry,
} from "../../../lib/equity-map/simplifyRouteGeometry";
import { computeVScoreMap } from "../../../lib/equity-map/vulnerabilityScore";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import {
  FLAT_BASEMAP_STYLE,
  HOOD_FEATURED_OUTLINE_PAINT,
  HOOD_HOVER_OUTLINE_PAINT,
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  ROUTE_ELIMINATED_LIGHT_GREY,
  ROUTE_REDUCED_DARK_GREY,
} from "./mapStyles";
import styles from "./EquityMap2.module.css";

const FEATURED_HOODS = new Set(["Lincoln-Lemington-Belmar", "Lower Lawrenceville"]);

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

/** Base circle radius in px per transit bucket (before zoom scaling). Tune multipliers inside `circleRadiusWithZoom`. */
const TRANSIT_BUCKET_RADIUS = {
  0: 1,
  1: 1,
  2: 2,
  3: 4,
};

/**
 * `circle-radius` scales with zoom. Mapbox requires `["zoom"]` only as the input to a **top-level**
 * `interpolate` or `step` — so we interpolate on zoom first, and each stop outputs a `match` on transit bucket.
 * @param {number} anchorZoom — usually `MAP_INITIAL_ZOOM`
 */
function circleRadiusWithZoom(anchorZoom) {
  const z = anchorZoom;
  const r0 = TRANSIT_BUCKET_RADIUS[0];
  const r1 = TRANSIT_BUCKET_RADIUS[1];
  const r2 = TRANSIT_BUCKET_RADIUS[2];
  const r3 = TRANSIT_BUCKET_RADIUS[3];
  /** Per-zoom multipliers; increase so dots grow more as you zoom in. */
  const m0 = 0.85;
  const m1 = 1;
  const m2 = 1.35;
  const m3 = 1.75;
  const bucketAt = (m) => [
    "match",
    ["to-number", ["get", "transit_bucket"]],
    0,
    r0 * m,
    1,
    r1 * m,
    2,
    r2 * m,
    3,
    r3 * m,
    r1 * m,
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    z,
    bucketAt(m0),
    z + 2,
    bucketAt(m1),
    z + 4,
    bucketAt(m2),
    z + 6.5,
    bucketAt(m3),
  ];
}

/**
 * Bivariate dot grid: simplified neighborhood masks, color = poverty tertile, size = transit quartile.
 * @param {{ title?: string; dek?: string }} props
 */
export default function EquityMap2({ title, dek }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);
  const [routeView, setRouteView] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [routesMissing, setRoutesMissing] = useState(false);
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  useEffect(() => {
    if (!token || !mapContainerRef.current) return;
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

      const vByNeighborhood = computeVScoreMap(hoodStats, routeStats);
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
        const vRow = vByNeighborhood.get(name);
        hoodByName.set(name, {
          poverty_rate: safeFloat(row.below_poverty_pct),
          pct_transit_dependent: safeFloat(row.transit_dependent_pct_proxy),
          routes_cut_or_reduced: useStreet ? row.routes_losing_street || "" : row.routes_losing || "",
          pct_access_lost: routesBefore > 0 ? routesLosing / routesBefore : 0,
          access_metric: useStreet ? "street" : "all_stops",
          v_score: vRow?.vScore ?? 0,
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
            v_score: m.v_score ?? 0,
            is_water: waterHeavy ? 1 : 0,
            is_featured: FEATURED_HOODS.has(hood) ? 1 : 0,
            serves_p10_71b: m.serves_p10_71b ?? 0,
          },
        };
      });

      const { dots, hoodsSimplified } = buildEquityMap2Data(hoodGeo);

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
              if (rid !== "P10" && rid !== "71B") return null;
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

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: FLAT_BASEMAP_STYLE,
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM,
        minZoom: MAP_INITIAL_ZOOM,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;

        map.addSource("equity-dots", { type: "geojson", data: dots });
        map.addLayer({
          id: "equity-dots-circle",
          type: "circle",
          source: "equity-dots",
          paint: {
            "circle-color": ["get", "dot_color"],
            "circle-radius": circleRadiusWithZoom(MAP_INITIAL_ZOOM),
            "circle-opacity": 0.9,
            "circle-stroke-width": 0,
          },
        });

        if (routeP1071bGeo?.features?.length) {
          map.addSource("routes-p10-71b", { type: "geojson", data: routeP1071bGeo });
          map.addLayer({
            id: "equity-routes-p10-71b",
            type: "line",
            source: "routes-p10-71b",
            paint: {
              "line-color": [
                "match",
                ["get", "route_id"],
                "P10",
                ROUTE_ELIMINATED_LIGHT_GREY,
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

        map.addSource("hood-hit", { type: "geojson", data: hoodsSimplified });
        map.addLayer({
          id: "hood-hit-fill",
          type: "fill",
          source: "hood-hit",
          paint: { "fill-opacity": 0 },
        });
        map.addLayer({
          id: "hood-featured-outline",
          type: "line",
          source: "hood-hit",
          filter: ["==", ["get", "is_featured"], 1],
          paint: HOOD_FEATURED_OUTLINE_PAINT,
        });
        map.addLayer({
          id: "hood-hover-outline",
          type: "line",
          source: "hood-hit",
          filter: ["==", ["get", "neighborhood_name"], ""],
          paint: HOOD_HOVER_OUTLINE_PAINT,
        });

        map.on("mousemove", "hood-hit-fill", (e) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const p = feature.properties || {};
          setHoverData({
            name: p.neighborhood_name,
            vScore: safeFloat(p.v_score, 0),
            pctTransit: safeFloat(p.pct_transit_dependent),
            povertyRate: safeFloat(p.poverty_rate),
            routesCut: p.routes_cut_or_reduced,
            pctAccessLost: safeFloat(p.pct_access_lost),
            accessMetric: p.access_metric === "street" ? "street" : "all_stops",
          });
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], p.neighborhood_name]);
        });

        map.on("mouseleave", "hood-hit-fill", () => {
          setHoverData(null);
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
        });

        if (!cancelled) {
          setMapReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      setRoutesMissing(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;

    const routeOnly = routeView ? ["==", ["to-number", ["get", "serves_p10_71b"]], 1] : null;

    if (map.getLayer("equity-dots-circle")) {
      map.setFilter("equity-dots-circle", routeOnly);
    }
    if (map.getLayer("hood-hit-fill")) {
      map.setFilter("hood-hit-fill", routeOnly);
    }
    if (map.getLayer("hood-featured-outline")) {
      map.setFilter(
        "hood-featured-outline",
        routeView
          ? [
              "all",
              ["==", ["to-number", ["get", "is_featured"]], 1],
              ["==", ["to-number", ["get", "serves_p10_71b"]], 1],
            ]
          : ["==", ["to-number", ["get", "is_featured"]], 1],
      );
    }
    setHoverData(null);
    if (map.getLayer("hood-hover-outline")) {
      map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
    }
  }, [routeView, mapReady]);

  if (!token) {
    return (
      <section className={styles.shell} aria-label="Equity dot map">
        <p className={styles.warn}>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to render the map.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-label="Equity pattern map">
      {(title || dek) && (
        <header className={styles.intro}>
          {title ? <h2>{title}</h2> : null}
          {dek ? <p>{dek}</p> : null}
        </header>
      )}

      <div className={styles.mapControls} role="group" aria-label="Map view">
        <span className={styles.mapControlsLabel}>View</span>
        <div className={styles.controlGroup}>
          <button
            type="button"
            className={`${styles.controlButton} ${!routeView ? styles.controlButtonActive : ""}`}
            onClick={() => setRouteView(false)}
          >
            Full region
          </button>
          <button
            type="button"
            className={`${styles.controlButton} ${routeView ? styles.controlButtonActive : ""}`}
            onClick={() => setRouteView(true)}
          >
            P10 + 71B corridors
          </button>
        </div>
      </div>

      <div className={styles.legendCard}>
        <p className={styles.legendHeading}>How to read the dot map</p>
        <div className={styles.legendGrid}>
          <span className={styles.legendRowLabel}>Poverty</span>
          <div className={styles.povertySwatches} role="list">
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: EQUITY_MAP2_POVERTY_COLORS[0] }}
              />
              Low (tertile)
            </span>
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: EQUITY_MAP2_POVERTY_COLORS[1] }}
              />
              Medium
            </span>
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: EQUITY_MAP2_POVERTY_COLORS[2] }}
              />
              High
            </span>
          </div>
          <span className={styles.legendRowLabel}>Transit dependence</span>
          <div className={styles.sizeDemo} role="list">
            {[
              { b: 3, label: "High — largest dots" },
              { b: 2, label: "Medium-high" },
              { b: 1, label: "Medium-low" },
              { b: 0, label: "Low — smallest" },
            ].map(({ b, label }) => {
              const d = Math.round(TRANSIT_BUCKET_RADIUS[b] * 7);
              return (
                <span key={b} className={styles.sizeStep} role="listitem">
                  <span className={styles.sizeCircle} style={{ width: d, height: d }} />
                  {label}
                </span>
              );
            })}
          </div>
        </div>
        <p className={styles.legendNote}>
          Boundaries are simplified so a regular dot grid can clip cleanly inside each neighborhood. Color and size
          bins use tertiles / quartiles of the values on this map (worker transit-commute proxy and share below
          poverty from the neighborhood profile table).{" "}
          <strong>P10 + 71B corridors</strong> limits dots to neighborhoods whose pre-FY26 route list includes P10 or
          71B in <code>fy26_route_n_profiles_all.csv</code> (street-served list when available). Lines: P10 (lighter),
          71B (darker) — FY26 styling hint.
        </p>
      </div>

      <div className={styles.body}>
        <div className={styles.mapPane}>
          {routesMissing && (
            <p className={styles.routesWarn}>
              Route lines unavailable: add <code>route_lines_current.geojson</code> with P10 and 71B alignments.
            </p>
          )}
          <div className={styles.mapCanvas} ref={mapContainerRef} />
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
              <dt>Vulnerability (V)</dt>
              <dd>
                <span className={styles.metric}>{hoverData.vScore}</span>
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
