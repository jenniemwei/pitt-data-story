"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import { rowServesP10Or71B } from "../../../lib/equity-map/equityMap2RouteHoods";
import { buildEquityMap3Data, EQUITY_MAP3_GRID_CELL_KM } from "../../../lib/equity-map/buildEquityMap3Dots";
import { EQUITY_MAP2_POVERTY_COLORS } from "../../../lib/equity-map/buildEquityMap2Dots";
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
import styles from "./EquityMap3.module.css";

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

/** Same as Mapbox `getMetersPerPixelAtLatitude` (512px world width, Web Mercator). */
const EARTH_CIRCUMFERENCE_M = 40075017;

function metersPerPixelAtLatZoom(latDeg, zoom) {
  const latRad = (latDeg * Math.PI) / 180;
  return (Math.cos(latRad) * EARTH_CIRCUMFERENCE_M) / (2 ** zoom * 512);
}

/**
 * Relative to ground radius for largest tier (1 = half of neighbor spacing in meters — tangent circles).
 * Smaller tiers are larger than the old 1:1:2:4 curve.
 */
const TRANSIT_BUCKET_MULT = [0.58, 0.58, 0.84, 1];

/**
 * Neighbor spacing on the ground (meters), same as Turf `pointGrid(..., cellKm, { units: "kilometers" })`.
 */
function neighborSpacingMeters(cellKm) {
  return cellKm * 1000;
}

/**
 * Circle radius on the ground (meters): half of neighbor spacing × tier, so tier 3 dots are tangent in map space
 * when converted with the same scale as point positions.
 */
function radiusMetersForTransitBucket(cellKm, bucket) {
  return (neighborSpacingMeters(cellKm) / 2) * TRANSIT_BUCKET_MULT[bucket];
}

/**
 * Mapbox `circle-radius` is always in **pixels**; convert ground meters → px using the same projection scale as
 * geographic coordinates at `latDeg` and `zoom`.
 */
function radiusPxForTransitBucket(latDeg, zoom, cellKm, bucket) {
  const mpp = metersPerPixelAtLatZoom(latDeg, zoom);
  return radiusMetersForTransitBucket(cellKm, bucket) / mpp;
}

/**
 * Interpolate on zoom so radii stay tied to **ground** km/m (same system as grid locations). Each stop uses
 * `radiusPxForTransitBucket` — identical pipeline: ground definition → Mapbox mpp → px.
 */
function circleRadiusGroundMatchExpression() {
  const lat = MAP_CENTER[1];
  const cellKm = EQUITY_MAP3_GRID_CELL_KM;
  const z = MAP_INITIAL_ZOOM;
  const bucketAt = (zoom) => [
    "match",
    ["to-number", ["get", "transit_bucket"]],
    0,
    radiusPxForTransitBucket(lat, zoom, cellKm, 0),
    1,
    radiusPxForTransitBucket(lat, zoom, cellKm, 1),
    2,
    radiusPxForTransitBucket(lat, zoom, cellKm, 2),
    3,
    radiusPxForTransitBucket(lat, zoom, cellKm, 3),
    radiusPxForTransitBucket(lat, zoom, cellKm, 1),
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    z,
    bucketAt(z),
    z + 2,
    bucketAt(z + 2),
    z + 4,
    bucketAt(z + 4),
    z + 6.5,
    bucketAt(z + 6.5),
  ];
}

/** Legend demo — proportional to `TRANSIT_BUCKET_MULT` (scaled for legibility). */
const TRANSIT_LEGEND_RADIUS = {
  0: TRANSIT_BUCKET_MULT[0],
  1: TRANSIT_BUCKET_MULT[1],
  2: TRANSIT_BUCKET_MULT[2],
  3: TRANSIT_BUCKET_MULT[3],
};

/**
 * Global-grid dot map: lattice + radii both defined in ground km/m, converted to the map with Mapbox scale.
 * @param {{ title?: string; dek?: string }} props
 */
export default function EquityMap3({ title, dek }) {
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

      const { dots, hoodsSimplified } = buildEquityMap3Data(hoodGeo);

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

        map.addSource("em3-equity-dots", { type: "geojson", data: dots });
        map.addLayer({
          id: "em3-equity-dots-circle",
          type: "circle",
          source: "em3-equity-dots",
          paint: {
            "circle-color": ["get", "dot_color"],
            "circle-radius": circleRadiusGroundMatchExpression(),
            "circle-opacity": 0.9,
            "circle-stroke-width": 0,
          },
        });

        if (routeP1071bGeo?.features?.length) {
          map.addSource("em3-routes-p10-71b", { type: "geojson", data: routeP1071bGeo });
          map.addLayer({
            id: "em3-equity-routes-p10-71b",
            type: "line",
            source: "em3-routes-p10-71b",
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

        map.addSource("em3-hood-hit", { type: "geojson", data: hoodsSimplified });
        map.addLayer({
          id: "em3-hood-hit-fill",
          type: "fill",
          source: "em3-hood-hit",
          paint: { "fill-opacity": 0 },
        });
        map.addLayer({
          id: "em3-hood-featured-outline",
          type: "line",
          source: "em3-hood-hit",
          filter: ["==", ["get", "is_featured"], 1],
          paint: HOOD_FEATURED_OUTLINE_PAINT,
        });
        map.addLayer({
          id: "em3-hood-hover-outline",
          type: "line",
          source: "em3-hood-hit",
          filter: ["==", ["get", "neighborhood_name"], ""],
          paint: HOOD_HOVER_OUTLINE_PAINT,
        });

        map.on("mousemove", "em3-hood-hit-fill", (e) => {
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
          map.setFilter("em3-hood-hover-outline", ["==", ["get", "neighborhood_name"], p.neighborhood_name]);
        });

        map.on("mouseleave", "em3-hood-hit-fill", () => {
          setHoverData(null);
          map.setFilter("em3-hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
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

    if (map.getLayer("em3-equity-dots-circle")) {
      map.setFilter("em3-equity-dots-circle", routeOnly);
    }
    if (map.getLayer("em3-hood-hit-fill")) {
      map.setFilter("em3-hood-hit-fill", routeOnly);
    }
    if (map.getLayer("em3-hood-featured-outline")) {
      map.setFilter(
        "em3-hood-featured-outline",
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
    if (map.getLayer("em3-hood-hover-outline")) {
      map.setFilter("em3-hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
    }
  }, [routeView, mapReady]);

  if (!token) {
    return (
      <section className={styles.shell} aria-label="Equity global grid dot map">
        <p className={styles.warn}>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to render the map.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.shell} aria-label="Equity global grid dot map">
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
              { b: 3, label: "High — largest (touches at grid pitch)" },
              { b: 2, label: "Medium-high" },
              { b: 1, label: "Medium-low" },
              { b: 0, label: "Low — smallest" },
            ].map(({ b, label }) => {
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
        <p className={styles.legendNote}>
          One regional grid; simplified boundaries assign each dot to a neighborhood. Poverty tertiles and transit
          dependence quartiles match the map above (worker commute proxy from the profile table). Grid spacing and dot
          radii both come from the same ground distance (km / meters) and scale on screen with zoom like the points.{" "}
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
