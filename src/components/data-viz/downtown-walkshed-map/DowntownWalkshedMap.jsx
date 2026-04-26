"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import { restrictMapboxFreeformZoom } from "../../../lib/mapboxRestrictZoom";
import styles from "./DowntownWalkshedMap.module.css";

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

const WALKSHED_RADIUS_MILES = 0.25;
const MAP_BACKGROUND_FALLBACK = "#f7f7f7";

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function getCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function normalizeStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "eliminated") return "eliminated";
  if (s === "reduced") return "reduced";
  return "unchanged";
}

function classifyStopDowntownService(statusSet) {
  const hasUnchanged = statusSet.has("unchanged");
  const hasReduced = statusSet.has("reduced");
  if (hasUnchanged) {
    return { key: "active" };
  }
  if (hasReduced) {
    return { key: "reduced" };
  }
  return { key: "no_downtown" };
}

function weightForStatus(status) {
  if (status === "reduced") return 0.5;
  if (status === "eliminated") return 0;
  return 1;
}

function buildUnclippedWalkshedPolygons(stopFeatures) {
  const features = [];
  for (const stop of stopFeatures) {
    const [lon, lat] = stop.geometry?.coordinates || [];
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    const radiusMiles = WALKSHED_RADIUS_MILES;
    const ring = [];
    for (let i = 0; i <= 64; i += 1) {
      const theta = (i / 64) * Math.PI * 2;
      const dxMiles = Math.cos(theta) * radiusMiles;
      const dyMiles = Math.sin(theta) * radiusMiles;
      const dLat = dyMiles / 69;
      const dLon = dxMiles / (69 * Math.cos((lat * Math.PI) / 180) || 1e-6);
      ring.push([lon + dLon, lat + dLat]);
    }
    features.push({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ring] },
      properties: { ...stop.properties },
    });
  }
  return { type: "FeatureCollection", features };
}

export default function DowntownWalkshedMap() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const [counts, setCounts] = useState({ active: 0, reduced: 0, noDowntown: 0 });
  const [viewMode, setViewMode] = useState("after");
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  useEffect(() => {
    if (!token || !containerRef.current) return undefined;

    mapboxgl.accessToken = token;
    let cancelled = false;

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetch(dataAssetUrl("FY26_route_status_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_stop_per_route.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_lines_current.geojson"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([hoodGeo, routeStatusRaw, stopRowsRaw, routeLineGeo]) => {
      if (cancelled) return;

      const routeRows = parseCsv(routeStatusRaw);
      const stopRows = parseCsv(stopRowsRaw);

      const routeStatusById = new Map();
      for (const row of routeRows) {
        const route = normalizeRouteId(row.route_code || row.route_label || "");
        if (!route) continue;
        routeStatusById.set(route, normalizeStatus(row.route_status));
      }

      const neighborhoodNames = new Set(
        hoodGeo.features.map((f) => String(f.properties?.hood || "").trim()).filter(Boolean),
      );

      const stopMap = new Map();
      const downtownRouteIds = new Set();
      for (const row of stopRows) {
        if (String(row.mode || "").toUpperCase() !== "BUS") continue;
        // Inbound bus stop entries are the downtown-service proxy.
        if (String(row.direction || "").trim().toUpperCase() !== "IB") continue;

        const stopId = String(row.stop_id || "").trim();
        if (!stopId) continue;
        const hood = String(row.hood || "").trim();
        if (!neighborhoodNames.has(hood)) continue;

        const route = normalizeRouteId(row.route_id || row.routes || row.route_filter || "");
        if (!route) continue;
        downtownRouteIds.add(route);
        const status = routeStatusById.get(route) || "unchanged";

        const lat = Number(row.stop_lat || row.y);
        const lon = Number(row.stop_lon || row.x);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        const existing = stopMap.get(stopId) || {
          stopId,
          stopName: String(row.stop_name || stopId),
          hood,
          lat,
          lon,
          routeStatuses: new Set(),
          weightedService: 0,
          totalRoutes: 0,
        };
        existing.routeStatuses.add(status);
        existing.weightedService += weightForStatus(status);
        existing.totalRoutes += 1;
        stopMap.set(stopId, existing);
      }

      const stopFeatures = [];
      const localCounts = { active: 0, reduced: 0, noDowntown: 0 };

      for (const stop of stopMap.values()) {
        const cls = classifyStopDowntownService(stop.routeStatuses);
        if (cls.key === "active") localCounts.active += 1;
        else if (cls.key === "reduced") localCounts.reduced += 1;
        else localCounts.noDowntown += 1;
        const serviceRatio = stop.totalRoutes > 0 ? stop.weightedService / stop.totalRoutes : 0;

        stopFeatures.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [stop.lon, stop.lat] },
          properties: {
            stop_id: stop.stopId,
            stop_name: stop.stopName,
            hood: stop.hood || "Unknown",
            service_class: cls.key,
            service_ratio: Math.max(0, Math.min(1, serviceRatio)),
          },
        });
      }

      setCounts(localCounts);

      const enrichedFeatures = hoodGeo.features.map((f) => {
        const awater = Number(f.properties?.awater10 || 0);
        const aland = Number(f.properties?.aland10 || 0);
        return {
          ...f,
          properties: {
            ...f.properties,
            is_water: awater > 0 && aland === 0 ? 1 : 0,
          },
        };
      });

      const stopGeo = { type: "FeatureCollection", features: stopFeatures };
      const walkshedGeo = buildUnclippedWalkshedPolygons(stopFeatures);
      const routeGeo = routeLineGeo?.features?.length
        ? {
            type: "FeatureCollection",
            features: routeLineGeo.features
              .map((f) => {
                const rawId = String(f.properties?.route_code || f.properties?.route_filter || "")
                  .trim()
                  .toUpperCase();
                const routeId = normalizeRouteId(rawId);
                if (!routeId || !downtownRouteIds.has(routeId)) return null;
                const status = routeStatusById.get(routeId) || "unchanged";
                return {
                  ...f,
                  properties: {
                    ...f.properties,
                    route_id: routeId,
                    route_status: status,
                  },
                };
              })
              .filter(Boolean),
          }
        : null;
      const accentMain = getCssVar("--accent-main", "#111111");
      const mapBackground = getCssVar("--g0", MAP_BACKGROUND_FALLBACK);
      const hoodOutline = getCssVar("--g6", "#363636");

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: {
          ...FLAT_BASEMAP_STYLE,
          layers: FLAT_BASEMAP_STYLE.layers.map((layer) =>
            layer.id === "basemap-flat"
              ? {
                  ...layer,
                  paint: { ...(layer.paint || {}), "background-color": mapBackground },
                }
              : layer,
          ),
        },
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM + 0.85,
        attributionControl: true,
      });
      mapRef.current = map;
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      restrictMapboxFreeformZoom(map, { preserveDragPan: false });

      map.on("load", () => {
        map.addSource("hoods", {
          type: "geojson",
          data: { ...hoodGeo, features: enrichedFeatures },
        });
        map.addSource("downtown-stops", { type: "geojson", data: stopGeo });
        map.addSource("walksheds", { type: "geojson", data: walkshedGeo });
        if (routeGeo) {
          map.addSource("downtown-routes", { type: "geojson", data: routeGeo });
        }

        map.addLayer({
          id: "walkshed-fill",
          type: "fill",
          source: "walksheds",
          paint: {
            "fill-color": "#000000",
            "fill-opacity":
              viewMode === "before"
                ? 0.9
                : [
                    "case",
                    ["<=", ["coalesce", ["get", "service_ratio"], 0], 0],
                    0,
                    ["+", 0.2, ["*", 0.65, ["coalesce", ["get", "service_ratio"], 0]]],
                  ],
          },
        });

        map.addLayer({
          id: "hood-line",
          type: "line",
          source: "hoods",
          paint: {
            "line-color": hoodOutline,
            "line-width": 0.55,
            "line-opacity": 0.9,
          },
        });

        map.addLayer({
          id: "downtown-stop-dots",
          type: "circle",
          source: "downtown-stops",
          paint: {
            "circle-radius": 2.2,
            "circle-color": "#ffffff",
            "circle-opacity": 0.95,
            "circle-stroke-color": "#000000",
            "circle-stroke-width": 0.35,
          },
        });

        if (routeGeo) {
          map.addLayer({
            id: "downtown-route-lines-unchanged",
            type: "line",
            source: "downtown-routes",
            filter: ["==", ["get", "route_status"], "unchanged"],
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.15,
              "line-opacity": 1,
            },
          });

          map.addLayer({
            id: "downtown-route-lines-reduced",
            type: "line",
            source: "downtown-routes",
            filter: ["==", ["get", "route_status"], "reduced"],
            paint: {
              "line-color": "#ffffff",
              "line-width": 1.15,
              "line-opacity": 0.2,
            },
          });
        }
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyMode = () => {
      if (!map.getLayer("walkshed-fill")) return;
      map.setPaintProperty(
        "walkshed-fill",
        "fill-opacity",
        viewMode === "before"
          ? 0.9
          : [
              "case",
              ["<=", ["coalesce", ["get", "service_ratio"], 0], 0],
              0,
              ["+", 0.2, ["*", 0.65, ["coalesce", ["get", "service_ratio"], 0]]],
            ],
      );
    };
    if (map.isStyleLoaded()) applyMode();
    else map.once("load", applyMode);
  }, [viewMode]);

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <h2>Downtown bus-stop walksheds after FY26 changes</h2>
        <p>
          Each bus stop has a quarter-mile radial walkshed. Inbound stop entries (<code>direction = IB</code>) are
          treated as the downtown-service proxy for walksheds. After mode scales each walkshed by retained service at
          that stop (unchanged = 1, reduced = 0.5, eliminated = 0), clipped to neighborhood boundaries.
        </p>
        <div className={styles.toggleRow} role="group" aria-label="Walkshed map mode">
          <button
            type="button"
            onClick={() => setViewMode("before")}
            className={`${styles.toggleButton} ${viewMode === "before" ? styles.toggleButtonActive : ""}`}
            aria-pressed={viewMode === "before"}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setViewMode("after")}
            className={`${styles.toggleButton} ${viewMode === "after" ? styles.toggleButtonActive : ""}`}
            aria-pressed={viewMode === "after"}
          >
            After
          </button>
        </div>
      </header>
      <div ref={containerRef} className={styles.map} />
      <aside className={styles.legend} aria-label="Walkshed map legend">
        <div className={styles.legendTitle}>Walkshed reveal (1/4 mile)</div>
        <div className={styles.legendRow}>
          <span className={styles.swatchRouteFull} aria-hidden />
          <span>Route visible (unchanged)</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchRouteReduced} aria-hidden />
          <span>Route visible (reduced)</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchActive} aria-hidden />
          <span>Downtown service still active: {counts.active.toLocaleString()} stops</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchReduced} aria-hidden />
          <span>Downtown service reduced: {counts.reduced.toLocaleString()} stops</span>
        </div>
        <div className={styles.legendRow}>
          <span className={styles.swatchNone} aria-hidden />
          <span>No downtown route remains: {counts.noDowntown.toLocaleString()} stops</span>
        </div>
      </aside>
    </section>
  );
}

