"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { useNeighborhoodPanel } from "../../../contexts/NeighborhoodPanelContext";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import { restrictMapboxFreeformZoom } from "../../../lib/mapboxRestrictZoom";
import {
  buildHoverPayload,
  lossWeightForRoute,
  mergeDisplayAndNProfiles,
  normalizeStatus,
  parseRouteList,
} from "../../../lib/neighborhoodPanelPayload";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import styles from "./CoverageMap.module.css";

const FLAT_BASEMAP_STYLE = {
  version: 8,
  name: "equity-flat",
  metadata: { "mapbox:autocomposite": false },
  sources: {},
  layers: [{ id: "basemap-flat", type: "background", paint: { "background-color": "#f7f7f7" } }],
};
const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.1;
/** Fill opacity from proportional lost coverage (0–1): 0.2 baseline → 1.0 at max loss. */
const LOSS_FILL_OPACITY_EXPRESSION = [
  "min",
  1,
  [
    "max",
    0.2,
    [
      "+",
      0.2,
      ["*", 0.8, ["coalesce", ["get", "lost_coverage"], 0]],
    ],
  ],
];
const AFTER_ROUTE_OPACITY_EXPRESSION = [
  "match",
  ["get", "route_status"],
  "unchanged",
  1,
  "reduced",
  0.5,
  "eliminated",
  0,
  1,
];

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function getCssVar(name, fallback) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function extendBoundsForCoords(bounds, coords) {
  if (!Array.isArray(coords) || coords.length === 0) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    bounds.extend([coords[0], coords[1]]);
    return;
  }
  for (const child of coords) {
    extendBoundsForCoords(bounds, child);
  }
}

function fitNeighborhoodBounds(map, featureCollection, fitOptions) {
  if (!featureCollection?.features?.length) return;
  const bounds = new mapboxgl.LngLatBounds();
  for (const feature of featureCollection.features) {
    extendBoundsForCoords(bounds, feature?.geometry?.coordinates);
  }
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: 48,
      maxZoom: 12.5,
      duration: 0,
      ...fitOptions,
    });
  }
}

function fitMapToFeature(map, feature, fitOptions) {
  if (!feature?.geometry) return;
  const bounds = new mapboxgl.LngLatBounds();
  extendBoundsForCoords(bounds, feature.geometry.coordinates);
  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: 13.8,
      duration: 550,
      ...fitOptions,
    });
  }
}

function applyCoverageViewMode(map, viewMode, accentMain) {
  if (!map.getLayer("coverage-hood-fill")) return;
  map.setPaintProperty("coverage-hood-fill", "fill-color", accentMain);
  map.setPaintProperty("coverage-hood-fill", "fill-opacity", LOSS_FILL_OPACITY_EXPRESSION);
  if (map.getLayer("coverage-routes-line")) {
    map.setPaintProperty(
      "coverage-routes-line",
      "line-opacity",
      viewMode === "before" ? 1 : AFTER_ROUTE_OPACITY_EXPRESSION,
    );
  }
}

export default function CoverageMap() {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const selectedIdRef = useRef(null);
  const selectedRef = useRef(null);
  const profilesRef = useRef(new Map());
  const cityFeatureCollectionRef = useRef(null);
  const viewModeRef = useRef("before");
  const accentMainRef = useRef("#111111");
  const [viewMode, setViewMode] = useState("before");
  const [showRoutes, setShowRoutes] = useState(false);
  const [hoverData, setHoverData] = useState(null);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const {
    setCoveragePanelBase,
    setCoverageSelected,
    registerClearCoverageSelection,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useNeighborhoodPanel();
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  selectedRef.current = selectedNeighborhood;
  viewModeRef.current = viewMode;

  const clearSelectionOnMap = useCallback(() => {
    const map = mapRef.current;
    const id = selectedIdRef.current;
    if (map && id != null) {
      try {
        map.setFeatureState({ source: "coverage-hoods", id }, { selected: false });
      } catch {
        /* ignore */
      }
    }
    selectedIdRef.current = null;
    setSelectedNeighborhood(null);
    const coll = cityFeatureCollectionRef.current;
    if (map && coll?.features?.length) {
      fitNeighborhoodBounds(map, coll, { duration: 550 });
    }
  }, []);

  const recenterMap = useCallback(() => {
    const map = mapRef.current;
    const coll = cityFeatureCollectionRef.current;
    if (map && coll?.features?.length) {
      fitNeighborhoodBounds(map, coll, { duration: 650 });
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") clearSelectionOnMap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelectionOnMap]);

  useEffect(() => {
    setCoveragePanelBase(selectedNeighborhood || hoverData);
    setCoverageSelected(selectedNeighborhood);
  }, [hoverData, selectedNeighborhood, setCoveragePanelBase, setCoverageSelected]);

  useEffect(() => {
    registerClearCoverageSelection(clearSelectionOnMap);
    return () => registerClearCoverageSelection(null);
  }, [clearSelectionOnMap, registerClearCoverageSelection]);

  useEffect(() => {
    if (!token || !containerRef.current) return undefined;

    mapboxgl.accessToken = token;
    let cancelled = false;

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("FY26_route_status_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_lines_current.geojson"))
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(dataAssetUrl("n_profiles_new.csv"))
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
      fetch(dataAssetUrl("neighborhood_display_profiles.csv"))
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
    ]).then(([hoodGeo, profilesRaw, routeStatusRaw, routeLineGeo, nProfilesRaw, displayRaw]) => {
      if (cancelled) return;

      const profileRows = parseCsv(profilesRaw);
      const routeRows = parseCsv(routeStatusRaw);
      const nProfileRows = nProfilesRaw ? parseCsv(nProfilesRaw) : [];
      const displayRows = displayRaw ? parseCsv(displayRaw) : [];
      const nHoodOnly = nProfileRows.filter(
        (r) => String(r.geography_type || "").toLowerCase() === "neighborhood",
      );
      const profilesByHood = mergeDisplayAndNProfiles(displayRows, nHoodOnly);
      profilesRef.current = profilesByHood;

      const statusByRoute = new Map();
      const reductionTierByRoute = new Map();
      for (const row of routeRows) {
        const routeId = normalizeRouteId(row.route_code || row.route_label || "");
        if (!routeId) continue;
        const status = normalizeStatus(row.route_status);
        statusByRoute.set(routeId, status);
        reductionTierByRoute.set(routeId, row.reduction_tier);
      }

      const routesByNeighborhood = new Map();
      for (const row of profileRows) {
        const neighborhood = String(row.neighborhood || row.hood || "").trim();
        if (!neighborhood) continue;
        if (!routesByNeighborhood.has(neighborhood)) routesByNeighborhood.set(neighborhood, new Set());
        const routes = parseRouteList(row.routes_before);
        for (const routeId of routes) {
          routesByNeighborhood.get(neighborhood).add(routeId);
        }
      }

      const enrichedFeatures = hoodGeo.features.map((feature) => {
        const neighborhood = String(feature.properties?.hood || "").trim();
        const routes = routesByNeighborhood.get(neighborhood) || new Set();
        const total = routes.size;
        let lossSum = 0;
        for (const routeId of routes) {
          const st = statusByRoute.get(routeId) || "unchanged";
          lossSum += lossWeightForRoute(st, reductionTierByRoute.get(routeId));
        }
        const lostCoverage = total > 0 ? Math.max(0, Math.min(1, lossSum / total)) : 0;
        const beforeRoutes = Array.from(routes).sort((a, b) =>
          String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }),
        );
        const afterRoutes = beforeRoutes.filter((routeId) => (statusByRoute.get(routeId) || "unchanged") !== "eliminated");

        return {
          ...feature,
          properties: {
            ...feature.properties,
            neighborhood_name: neighborhood,
            lost_coverage: lostCoverage,
            routes_before_csv: beforeRoutes.join(", "),
            routes_after_csv: afterRoutes.join(", "),
            routes_before_count: beforeRoutes.length,
            routes_after_count: afterRoutes.length,
            is_water:
              Number(feature.properties?.awater10 || 0) > 0 && Number(feature.properties?.aland10 || 0) === 0
                ? 1
                : 0,
          },
        };
      });

      cityFeatureCollectionRef.current = { ...hoodGeo, features: enrichedFeatures };

      const n0 = getCssVar("--n0", "#f7f7f7");
      const accentMain = getCssVar("--accent-main", "#111111");
      accentMainRef.current = accentMain;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: {
          ...FLAT_BASEMAP_STYLE,
          layers: FLAT_BASEMAP_STYLE.layers.map((layer) =>
            layer.id === "basemap-flat"
              ? { ...layer, paint: { ...(layer.paint || {}), "background-color": n0 } }
              : layer,
          ),
        },
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM + 0.45,
        attributionControl: true,
      });
      mapRef.current = map;

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      restrictMapboxFreeformZoom(map);

      map.on("load", () => {
        map.addSource("coverage-hoods", {
          type: "geojson",
          data: { ...hoodGeo, features: enrichedFeatures },
          promoteId: "neighborhood_name",
        });
        map.addLayer({
          id: "coverage-hood-fill",
          type: "fill",
          source: "coverage-hoods",
          paint: {
            "fill-color": accentMain,
            "fill-opacity": LOSS_FILL_OPACITY_EXPRESSION,
          },
        });
        map.addLayer({
          id: "coverage-hood-selected",
          type: "line",
          source: "coverage-hoods",
          paint: {
            "line-color": "#ffffff",
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.5, 0],
            "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, 0],
          },
        });

        const clearHover = () => {
          map.getCanvas().style.cursor = "";
          if (!selectedRef.current) setHoverData(null);
        };

        const onMoveFromHoodProps = (props) => {
          if (!props) return;
          map.getCanvas().style.cursor = "pointer";
          if (selectedRef.current) return;
          setHoverData(buildHoverPayload(props, profilesRef.current));
        };

        map.on("mousemove", "coverage-hood-fill", (e) => {
          onMoveFromHoodProps(e.features?.[0]?.properties);
        });
        map.on("mouseleave", "coverage-hood-fill", clearHover);

        const onClickHoodFeature = (feature) => {
          if (!feature?.properties) return;
          const id = feature.properties.neighborhood_name;
          if (!id) return;

          const prev = selectedIdRef.current;
          if (prev === id) {
            map.setFeatureState({ source: "coverage-hoods", id: prev }, { selected: false });
            selectedIdRef.current = null;
            setSelectedNeighborhood(null);
            const city = cityFeatureCollectionRef.current;
            if (city?.features?.length) fitNeighborhoodBounds(map, city, { duration: 600 });
            return;
          }
          if (prev != null) {
            map.setFeatureState({ source: "coverage-hoods", id: prev }, { selected: false });
          }
          selectedIdRef.current = id;
          map.setFeatureState({ source: "coverage-hoods", id }, { selected: true });
          setSelectedNeighborhood(buildHoverPayload(feature.properties, profilesRef.current));
          fitMapToFeature(map, feature);
        };

        map.on("click", "coverage-hood-fill", (e) => onClickHoodFeature(e.features?.[0]));

        applyCoverageViewMode(map, viewModeRef.current, accentMain);

        fitNeighborhoodBounds(map, { ...hoodGeo, features: enrichedFeatures });
        void (async () => {
          if (cancelled || mapRef.current !== map) return;
          if (routeLineGeo?.features?.length) {
            const routeFeatures = routeLineGeo.features
              .map((feature) => {
                const routeId = normalizeRouteId(
                  feature.properties?.route_code || feature.properties?.route_filter || "",
                );
                if (!routeId || !statusByRoute.has(routeId)) return null;
                return {
                  ...feature,
                  properties: {
                    ...feature.properties,
                    route_id: routeId,
                    route_status: statusByRoute.get(routeId) || "unchanged",
                  },
                };
              })
              .filter(Boolean);

            map.addSource("coverage-routes", {
              type: "geojson",
              data: {
                type: "FeatureCollection",
                features: routeFeatures,
              },
            });
            map.addLayer({
              id: "coverage-routes-line",
              type: "line",
              source: "coverage-routes",
              paint: {
                "line-color": "#ffffff",
                "line-width": 0.7,
                "line-opacity": AFTER_ROUTE_OPACITY_EXPRESSION,
              },
              layout: {
                "line-join": "round",
                "line-cap": "round",
                visibility: "none",
              },
            });
            applyCoverageViewMode(map, viewModeRef.current, accentMainRef.current);
          }
        })();
      });
    });

    return () => {
      cancelled = true;
      setHoverData(null);
      setSelectedNeighborhood(null);
      selectedIdRef.current = null;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      applyCoverageViewMode(map, viewMode, accentMainRef.current);
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [viewMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyRouteVisibility = () => {
      if (!map.getLayer("coverage-routes-line")) return;
      map.setLayoutProperty("coverage-routes-line", "visibility", showRoutes ? "visible" : "none");
    };

    if (map.isStyleLoaded()) applyRouteVisibility();
    else map.once("load", applyRouteVisibility);
  }, [showRoutes]);

  return (
    <div className={styles.coverageMapSection}>
      <div className={styles.mapShell}>
        <div ref={containerRef} className={styles.map} role="presentation" />
        {sidebarCollapsed && (
          <button
            type="button"
            className={styles.expandFab}
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand neighborhood panel"
          >
            ‹
          </button>
        )}
          <div className={styles.mapControls}>
            <div className={styles.mapOverlay} role="group" aria-label="Map mode">
              <button
                type="button"
                className={`${styles.modeLink} ${viewMode === "before" ? styles.modeLinkOn : ""}`}
                onClick={() => setViewMode("before")}
              >
                before
              </button>
              <span className={styles.modeSep} aria-hidden>
                |
              </span>
              <button
                type="button"
                className={`${styles.modeLink} ${viewMode === "after" ? styles.modeLinkOn : ""}`}
                onClick={() => setViewMode("after")}
              >
                after
              </button>
            </div>
            <button type="button" className={styles.recenterBtn} onClick={recenterMap}>
              Re-center map
            </button>
            <label className={styles.routeToggle}>
              <input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} />
              <span>routes</span>
            </label>
          </div>
      </div>
    </div>
  );
}
