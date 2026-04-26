"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId, POVERTY_HIGH_THRESHOLD } from "../../../lib/equity-map/constants";
import { povertyRateAsRatio } from "../../../lib/equity-map/dot-map/buildGeojson";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import { restrictMapboxFreeformZoom } from "../../../lib/mapboxRestrictZoom";
import styles from "./OrphanedStopsMap.module.css";

// map styles
const FLAT_BASEMAP_STYLE = {
  version: 8,
  name: "equity-flat",
  metadata: { "mapbox:autocomposite": false },
  sources: {},
  layers: [{ id: "basemap-flat", type: "background", paint: { "background-color": "#f7f7f7" } }],
};
const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.1;
const POVERTY_LEVEL_FILL_HIGH = "#D85C4D";
const POVERTY_LEVEL_FILL_LOW = "#D1CDC8";
const WATER_FILL = "#999999";

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function fmtPct(v) {
  return `${(Number(v || 0) * 100).toFixed(1)}%`;
}

export default function OrphanedStopsMap() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [legend, setLegend] = useState(null);
  const [orphanCount, setOrphanCount] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  useEffect(() => {
    if (!token || !containerRef.current) return undefined;
    mapboxgl.accessToken = token;
    let cancelled = false;

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("FY26_route_status_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_stop_per_route.csv")).then((r) => r.text()),
    ]).then(([hoodGeo, profilesRaw, routeStatusRaw, stopRowsRaw]) => {
      if (cancelled) return;

      const profileRows = parseCsv(profilesRaw);
      const routeRows = parseCsv(routeStatusRaw);
      const stopRows = parseCsv(stopRowsRaw);

      const povertyByNeighborhood = new Map();
      for (const row of profileRows) {
        const n = String(row.neighborhood || "").trim();
        if (!n) continue;
        const poverty = Number(row.below_poverty_pct);
        if (Number.isFinite(poverty)) povertyByNeighborhood.set(n, poverty);
      }

      /** Routes that still exist after FY26 (anything in the status file that is not eliminated). */
      const remainingRoutes = new Set();
      for (const row of routeRows) {
        const route = normalizeRouteId(row.route_code || row.route_label || "");
        if (!route) continue;
        const status = String(row.route_status || "").trim().toLowerCase();
        if (status !== "eliminated") remainingRoutes.add(route);
      }

      const stopMap = new Map();
      for (const row of stopRows) {
        if (String(row.mode || "").toUpperCase() !== "BUS") continue;
        const stopId = String(row.stop_id || "").trim();
        if (!stopId) continue;
        const route = normalizeRouteId(row.route_id || row.routes || row.route_filter || "");
        if (!route) continue;
        const lat = Number(row.stop_lat || row.y);
        const lon = Number(row.stop_lon || row.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const key = stopId;
        const existing = stopMap.get(key) || {
          stopId,
          stopName: String(row.stop_name || stopId),
          lat,
          lon,
          hood: String(row.hood || "").trim(),
          routes: new Set(),
        };
        existing.routes.add(route);
        stopMap.set(key, existing);
      }

      /** Orphan = no bus route that is still operating (per FY26 status) appears at this stop in the stop–route table. */
      const orphaned = [];
      for (const stop of stopMap.values()) {
        let hasRemaining = false;
        for (const r of stop.routes) {
          if (remainingRoutes.has(r)) hasRemaining = true;
        }
        if (!hasRemaining) orphaned.push(stop);
      }

      const enrichedFeatures = hoodGeo.features.map((f) => {
        const name = String(f.properties?.hood || "");
        const raw = povertyByNeighborhood.get(name);
        const ratio = Number.isFinite(raw) ? povertyRateAsRatio(raw) ?? 0 : 0;
        const awater = Number(f.properties?.awater10 || 0);
        const aland = Number(f.properties?.aland10 || 0);
        return {
          ...f,
          properties: {
            ...f.properties,
            poverty_rate: ratio,
            is_water: awater > 0 && aland === 0 ? 1 : 0,
          },
        };
      });

      setLegend({
        low: `Below ${fmtPct(POVERTY_HIGH_THRESHOLD)} poverty`,
        high: `${fmtPct(POVERTY_HIGH_THRESHOLD)} or more poverty`,
      });

      const neighborhoodNames = new Set(
        enrichedFeatures.map((f) => String(f.properties?.hood || "").trim()).filter(Boolean),
      );

      const orphanedInView = orphaned.filter((s) => neighborhoodNames.has(String(s.hood || "").trim()));
      setOrphanCount(orphanedInView.length);
      const orphanIds = new Set(orphanedInView.map((s) => s.stopId));

      const remainingFeatures = [];
      for (const stop of stopMap.values()) {
        if (orphanIds.has(stop.stopId)) continue;
        const hood = String(stop.hood || "").trim();
        if (!neighborhoodNames.has(hood)) continue;
        remainingFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
          properties: {
            stop_id: stop.stopId,
            stop_name: stop.stopName,
            hood: stop.hood || "Unknown",
          },
        });
      }
      setRemainingCount(remainingFeatures.length);

      const orphanGeo = {
        type: "FeatureCollection",
        features: orphanedInView.map((s) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [s.lon, s.lat] },
          properties: {
            stop_id: s.stopId,
            stop_name: s.stopName,
            hood: s.hood || "Unknown",
            route_count: s.routes.size,
          },
        })),
      };

      const remainingGeo = {
        type: "FeatureCollection",
        features: remainingFeatures,
      };

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: FLAT_BASEMAP_STYLE,
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM + 0.8,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      restrictMapboxFreeformZoom(map, { preserveDragPan: false });

      map.on("load", () => {
        map.addSource("neighborhoods", {
          type: "geojson",
          data: { ...hoodGeo, features: enrichedFeatures },
        });
        map.addSource("orphaned-stops", {
          type: "geojson",
          data: orphanGeo,
        });
        map.addSource("remaining-stops", {
          type: "geojson",
          data: remainingGeo,
        });

        map.addLayer({
          id: "hood-fill",
          type: "fill",
          source: "neighborhoods",
          paint: {
            "fill-color": [
              "case",
              ["==", ["get", "is_water"], 1],
              WATER_FILL,
              [">=", ["get", "poverty_rate"], POVERTY_HIGH_THRESHOLD],
              POVERTY_LEVEL_FILL_HIGH,
              POVERTY_LEVEL_FILL_LOW,
            ],
            "fill-opacity": 0.88,
          },
        });

        map.addLayer({
          id: "hood-line",
          type: "line",
          source: "neighborhoods",
          paint: {
            "line-color": "#ffffff",
            "line-width": 0.6,
            "line-opacity": 0.9,
          },
        });

        map.addLayer({
          id: "remaining-stop-dots",
          type: "circle",
          source: "remaining-stops",
          paint: {
            "circle-radius": 2,
            "circle-color": "#ffffff",
            "circle-stroke-color": "rgba(15, 23, 42, 0.22)",
            "circle-stroke-width": 0.45,
          },
        });

        map.addLayer({
          id: "orphaned-stop-dots",
          type: "circle",
          source: "orphaned-stops",
          paint: {
            "circle-radius": 3.5,
            "circle-color": "#000000",
            "circle-stroke-width": 0,
          },
        });

        map.addLayer({
          id: "orphaned-stop-hit",
          type: "circle",
          source: "orphaned-stops",
          paint: {
            "circle-radius": 10,
            "circle-color": "#000000",
            "circle-opacity": 0,
          },
        });

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "260px",
        });

        map.on("mouseenter", "orphaned-stop-hit", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const f = e.features?.[0];
          if (!f) return;
          const c = f.geometry?.coordinates;
          if (!Array.isArray(c)) return;
          popup
            .setLngLat(c)
            .setHTML(
              `<strong>${f.properties?.stop_name || f.properties?.stop_id}</strong><br/>` +
                `Neighborhood: ${f.properties?.hood || "Unknown"}`,
            )
            .addTo(map);
        });
        map.on("mouseleave", "orphaned-stop-hit", () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [token]);

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h1>Orphaned bus stops after FY26 cuts</h1>
        <p>
          Neighborhoods are color-coded below vs at/above {fmtPct(POVERTY_HIGH_THRESHOLD)} poverty (ACS). Small white
          dots are bus stops where at least one FY26 route that is still operating serves the stop; black dots are stops
          where no such route remains — i.e. no bus is listed at that stop after eliminations (
          <code>route_stop_per_route.csv</code> + <code>FY26_route_status_all.csv</code>).
        </p>
      </header>
      <div ref={containerRef} className={styles.map} />
      <aside className={styles.legend} aria-label="Map legend">
        <div className={styles.legendTitle}>Poverty scale</div>
        <div className={styles.legendRow}>
          <span className={styles.swatchLow} aria-hidden />
          <span>{legend?.low || "Low"}</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchHigh} aria-hidden />
          <span>{legend?.high || "High"}</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.dotRemaining} aria-hidden />
          <span>Remaining stops (still served): {remainingCount.toLocaleString()}</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.dot} aria-hidden />
          <span>Orphaned stops: {orphanCount}</span>
        </div>
      </aside>
    </section>
  );
}

