"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId } from "../../../../lib/equity-map/constants";
import { buildDotMapGeojson, transitSizeLegendFromCuts } from "../../../../lib/equity-map/dot-map/buildGeojson";
import { rowServesP10Or71B } from "../../../../lib/equity-map/dot-map/routeFilter";
import {
  ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG,
  simplifyRouteGeometry,
} from "../../../../lib/equity-map/simplifyRouteGeometry";
import { dataAssetUrl } from "../../../../lib/dataAssetUrl";
import {
  DOT_MAP_REGION_FILL,
  FLAT_BASEMAP_STYLE,
  HOOD_FEATURED_OUTLINE_PAINT,
  HOOD_HOVER_OUTLINE_PAINT,
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  POVERTY_LEVEL_COLORS,
  ROUTE_ELIMINATED_LIGHT_GREY,
  ROUTE_REDUCED_DARK_GREY,
} from "../mapStyles";
import {
  circleRadiusGroundMatchExpression,
  DOT_MAP_RESOLUTION_STEPS,
  TRANSIT_LEGEND_RADIUS,
} from "./mapboxPaint";
import styles from "./DotMap.module.css";

/** Persona neighborhoods — blue outline on the map (Marcus / Stanton Heights; Denise / Lincoln-Lemington-Belmar). */
const FEATURED_HOODS = new Set(["Stanton Heights", "Lincoln-Lemington-Belmar"]);

/** Match corridor scroll map: frame data, then lock zoom-out to that “home” view (recomputed when view toggles). */
const DOT_MAP_FIT_PADDING = { top: 28, bottom: 28, left: 24, right: 24 };
const DOT_MAP_FIT_MAX_ZOOM = 12.2;

function syncMinZoomToHomeView(map) {
  if (!map?.isStyleLoaded()) return;
  map.setMinZoom(map.getZoom());
}

/**
 * @param {import('mapbox-gl').Map} map
 * @param {GeoJSON.FeatureCollection} hoodFc
 * @param {boolean} routeOnlyHoods P10+71B corridor hoods only
 * @returns {boolean} whether fitBounds ran
 */
function fitDotMapToHoods(map, hoodFc, routeOnlyHoods) {
  const features = hoodFc.features.filter((f) => {
    if (Number(f.properties?.is_water) === 1) return false;
    if (routeOnlyHoods && Number(f.properties?.serves_p10_71b) !== 1) return false;
    return true;
  });
  if (!features.length) return false;
  const b = turf.bbox({ type: "FeatureCollection", features });
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

/**
 * Bivariate dot map: regional lattice, poverty color × transit-dependent size; radii in ground meters.
 * @param {{ title?: string; dek?: string }} props
 */
export default function DotMap({ title, dek }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  /** Enriched hood GeoJSON for camera bbox (full region vs P10+71B filter). */
  const hoodGeoCameraRef = useRef(/** @type {GeoJSON.FeatureCollection | null} */ (null));
  const dotMapFitGenerationRef = useRef(0);
  const [hoverData, setHoverData] = useState(null);
  const [routeView, setRouteView] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [routesMissing, setRoutesMissing] = useState(false);
  const [transitQuartileCuts, setTransitQuartileCuts] = useState(null);
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  const transitSizeLegend = useMemo(
    () => (transitQuartileCuts ? transitSizeLegendFromCuts(transitQuartileCuts) : null),
    [transitQuartileCuts],
  );

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
      const { hoodsSimplified, transitCuts } = builtPerStep[builtPerStep.length - 1];
      setTransitQuartileCuts(transitCuts);

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
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });
      mapRef.current = map;

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
          setMapReady(true);
        }
      });
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      setRoutesMissing(false);
      setTransitQuartileCuts(null);
      hoodGeoCameraRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    const hoodFc = hoodGeoCameraRef.current;
    if (!mapReady || !map?.isStyleLoaded() || !hoodFc?.features?.length) return;

    const generation = ++dotMapFitGenerationRef.current;
    const syncIfCurrent = () => {
      if (dotMapFitGenerationRef.current !== generation || mapRef.current !== map) return;
      syncMinZoomToHomeView(map);
    };

    const didFit = fitDotMapToHoods(map, hoodFc, routeView);
    if (!didFit) {
      syncIfCurrent();
      return;
    }
    map.once("moveend", syncIfCurrent);
    requestAnimationFrame(syncIfCurrent);
  }, [mapReady, routeView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map?.isStyleLoaded()) return;

    const routeOnly = routeView ? ["==", ["to-number", ["get", "serves_p10_71b"]], 1] : null;

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
        routeView ? ["all", landOnly, ["==", ["to-number", ["get", "serves_p10_71b"]], 1]] : landOnly,
      );
    }
    if (map.getLayer("dot-map-hood-hit-fill")) {
      map.setFilter("dot-map-hood-hit-fill", routeOnly);
    }
    if (map.getLayer("dot-map-hood-featured-outline")) {
      map.setFilter(
        "dot-map-hood-featured-outline",
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
    if (map.getLayer("dot-map-hood-hover-outline")) {
      map.setFilter("dot-map-hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
    }
  }, [routeView, mapReady]);

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    const hoodFc = hoodGeoCameraRef.current;
    if (!map?.isStyleLoaded() || !hoodFc?.features?.length) return;
    dotMapFitGenerationRef.current += 1;
    const didFit = fitDotMapToHoods(map, hoodFc, routeView);
    if (!didFit) {
      syncMinZoomToHomeView(map);
      return;
    }
    map.once("moveend", () => {
      if (mapRef.current !== map) return;
      syncMinZoomToHomeView(map);
    });
    requestAnimationFrame(() => {
      if (mapRef.current === map) syncMinZoomToHomeView(map);
    });
  }, [routeView]);

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
        <button
          type="button"
          className={`${styles.controlButton} ${styles.recenterButton}`}
          onClick={recenterMap}
          disabled={!mapReady}
          aria-label="Recenter map on the current view extent"
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
              Low (tertile)
            </span>
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: POVERTY_LEVEL_COLORS[1] }}
              />
              Medium
            </span>
            <span className={styles.swatch} role="listitem">
              <span
                className={styles.swatchDot}
                style={{ background: POVERTY_LEVEL_COLORS[2] }}
              />
              High
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
        <p className={styles.legendNote}>
          One regional lattice per zoom band; simplified boundaries assign each dot to a neighborhood. Zooming in
          switches to a finer grid (more dots); radii stay tied to that pitch so the largest transit tier stays tangent.
          Poverty tertiles on color; transit dependence uses three dot sizes (bottom two quartiles share the smallest).
          Worker commute proxy from the profile table.{" "}
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
