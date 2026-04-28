"use client";

import { useEffect, useMemo, useRef } from "react";
import mapboxgl from "mapbox-gl";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import { dataAssetUrl } from "../../lib/dataAssetUrl";
import { buildGroupedCoverageFeatures, buildHoodToGroupNameMap } from "../../lib/coverageHoodGroups";
import styles from "./NeighborhoodSelectorMap.module.css";

const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.5;

const WHITE_BASE_STYLE = {
  version: 8,
  name: "selector-flat-white",
  sources: {},
  layers: [{ id: "selector-flat-bg", type: "background", paint: { "background-color": "#ffffff" } }],
};

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function fitToFeatures(map, features) {
  const bounds = new mapboxgl.LngLatBounds();
  for (const feature of features) {
    const stack = [feature?.geometry?.coordinates];
    while (stack.length) {
      const next = stack.pop();
      if (!Array.isArray(next)) continue;
      if (typeof next[0] === "number" && typeof next[1] === "number") {
        bounds.extend([next[0], next[1]]);
      } else {
        for (const child of next) stack.push(child);
      }
    }
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 32, maxZoom: 12.5, duration: 0 });
}

export default function NeighborhoodSelectorMap({
  selectedNeighborhoods,
  onToggleNeighborhood,
  onHoverNeighborhood,
}) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  useEffect(() => {
    if (!token || !containerRef.current) return undefined;
    mapboxgl.accessToken = token;
    let cancelled = false;
    let featureNames = [];

    Promise.all([
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
      fetch(dataAssetUrl("display_profiles_2024.csv")).then((r) => r.text()),
    ]).then(([hoodGeo, displayRaw]) => {
      if (cancelled) return;
      const displayRows = parseCsv(displayRaw);
      const hoodSet = new Set(
        (hoodGeo.features || [])
          .map((f) => String(f?.properties?.hood || "").trim())
          .filter(Boolean),
      );
      const hoodToGroup = buildHoodToGroupNameMap(displayRows, hoodSet);
      const groupedFeatures = buildGroupedCoverageFeatures(hoodGeo.features || [], hoodToGroup);
      featureNames = groupedFeatures
        .map((f) => String(f?.properties?.neighborhood_name || "").trim())
        .filter(Boolean);

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: WHITE_BASE_STYLE,
        center: MAP_CENTER,
        zoom: MAP_INITIAL_ZOOM,
        attributionControl: false,
      });
      mapRef.current = map;
      map.scrollZoom.disable();
      map.boxZoom.disable();
      map.doubleClickZoom.disable();
      map.keyboard.disable();
      map.touchZoomRotate.disable();

      map.on("load", () => {
        map.addSource("selector-hoods", {
          type: "geojson",
          data: { type: "FeatureCollection", features: groupedFeatures },
          promoteId: "neighborhood_name",
        });
        map.addLayer({
          id: "selector-fill",
          type: "fill",
          source: "selector-hoods",
          paint: {
            "fill-color": "#ffffff",
            "fill-opacity": 1,
          },
        });
        map.addLayer({
          id: "selector-outline",
          type: "line",
          source: "selector-hoods",
          paint: {
            "line-color": "#5a5a5a",
            "line-width": 0.8,
          },
        });
        map.addLayer({
          id: "selector-selected",
          type: "line",
          source: "selector-hoods",
          paint: {
            "line-color": "#0f4646",
            "line-width": 2,
          },
          filter: ["in", ["get", "neighborhood_name"], ["literal", []]],
        });

        fitToFeatures(map, groupedFeatures);

        map.on("mousemove", "selector-fill", (e) => {
          map.getCanvas().style.cursor = "pointer";
          const hit = e.features?.[0];
          const name = String(hit?.properties?.neighborhood_name || "").trim();
          onHoverNeighborhood?.(name || null);
        });
        map.on("mouseleave", "selector-fill", () => {
          map.getCanvas().style.cursor = "";
          onHoverNeighborhood?.(null);
        });
        map.on("click", "selector-fill", (e) => {
          const hit = e.features?.[0];
          const name = String(hit?.properties?.neighborhood_name || "").trim();
          if (!name) return;
          onToggleNeighborhood(name, Boolean(e.originalEvent?.shiftKey));
        });
      });
    });

    return () => {
      cancelled = true;
      if (mapRef.current) mapRef.current.remove();
      mapRef.current = null;
    };
  }, [token, onToggleNeighborhood, onHoverNeighborhood]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const names = (selectedNeighborhoods || []).map((n) => String(n || "").trim()).filter(Boolean);
    const apply = () => {
      if (!map.getLayer("selector-fill")) return;
      if (names.length === 0) {
        map.setPaintProperty("selector-fill", "fill-color", "#ffffff");
        map.setPaintProperty("selector-fill", "fill-opacity", 1);
      } else {
        map.setPaintProperty("selector-fill", "fill-color", [
          "case",
          ["in", ["get", "neighborhood_name"], ["literal", names]],
          "#ffffff",
          "#d8d8d8",
        ]);
        map.setPaintProperty("selector-fill", "fill-opacity", [
          "case",
          ["in", ["get", "neighborhood_name"], ["literal", names]],
          1,
          0.9,
        ]);
      }
      if (map.getLayer("selector-selected")) {
        map.setFilter("selector-selected", ["in", ["get", "neighborhood_name"], ["literal", names]]);
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [selectedNeighborhoods]);

  return <div ref={containerRef} className={styles.map} role="presentation" />;
}
