"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import Papa from "papaparse";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./EquityMap.module.css";
import {
  FLAT_BASEMAP_STYLE,
  HOOD_FEATURED_OUTLINE_PAINT,
  HOOD_FILL_PAINT,
  HOOD_HOVER_OUTLINE_PAINT,
  HOOD_POVERTY_BUCKET_HIGH,
  MAP_CENTER,
  MAP_INITIAL_ZOOM,
  POVERTY_LEVEL_COLORS,
  ROUTE_ELIMINATED_LIGHT_GREY,
  ROUTE_NO_CHANGE_BLACK,
  ROUTE_NO_IMPACT_BLUE,
  ROUTE_REDUCED_DARK_GREY,
  ROUTE_REDUCED_MEDIUM_GREY,
  ROUTE_REDUCED_MID_GREY,
  ROUTE_REDUCED_STONE_GREY,
  ROUTE_VISUAL,
  ROUTES_AFTER_DETAILED_PAINT,
  ROUTES_AFTER_SIMPLE_PAINT,
  ROUTES_BEFORE_PAINT,
  ROUTES_ELIMINATED_PAINT,
  WATER_FILL,
} from "./mapStyles";
import { DataRationaleIcon } from "../../ui/DataRationaleIcon";
import { normalizeRouteId } from "../../../lib/equity-map/constants";
import {
  ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG,
  simplifyRouteGeometry,
} from "../../../lib/equity-map/simplifyRouteGeometry";
import {
  povertyColorBucket,
  povertyTercileCuts,
} from "../../../lib/equity-map/dot-map/buildGeojson";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";

/** Persona neighborhoods — blue outline (baseline: Stanton Heights; vulnerable: Lincoln-Lemington-Belmar). */
const FEATURED_HOODS = new Set(["Stanton Heights", "Lincoln-Lemington-Belmar"]);
const ACCESS_LOSS_THRESHOLD = 0.25;

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

function applyRoutesAfterPaint(map, simpleMode) {
  if (!map.getLayer("routes-after")) return;
  const paint = simpleMode ? ROUTES_AFTER_SIMPLE_PAINT : ROUTES_AFTER_DETAILED_PAINT;
  for (const [key, value] of Object.entries(paint)) {
    map.setPaintProperty("routes-after", key, value);
  }
}

/** Visibility for elimination layer: only after + detailed mode */
function syncEliminatedLayerVisibility(map, mode, simpleMode) {
  if (!map.getLayer("routes-after-eliminated")) return;
  const vis = mode === "after" && !simpleMode ? "visible" : "none";
  map.setLayoutProperty("routes-after-eliminated", "visibility", vis);
}

function syncRouteLayersAfterState(map, mode, simpleMode) {
  if (!map.getLayer("routes-after") || !map.getLayer("routes-before")) return;
  const afterVis = mode === "after" ? "visible" : "none";
  map.setLayoutProperty("routes-after", "visibility", afterVis);
  map.setLayoutProperty("routes-before", "visibility", mode === "before" ? "visible" : "none");
  applyRoutesAfterPaint(map, simpleMode);
  syncEliminatedLayerVisibility(map, mode, simpleMode);
}

export default function EquityMap() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [hoverData, setHoverData] = useState(null);
  const [mode, setMode] = useState("after");
  const [simpleMode, setSimpleMode] = useState(false);
  const [showHighDependencyOnly, setShowHighDependencyOnly] = useState(false);
  const [routesFileMissing, setRoutesFileMissing] = useState(false);

  const token = useMemo(() => process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "", []);

  const routeUiRef = useRef({ mode: "after", simpleMode: false });
  routeUiRef.current = { mode, simpleMode };

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
          pct_no_car: safeFloat(row.transit_dependent_pct_proxy),
          poverty_rate: safeFloat(row.below_poverty_pct),
          pct_transit_dependent: safeFloat(row.transit_dependent_pct_proxy),
          routes_cut_or_reduced: useStreet ? row.routes_losing_street || "" : row.routes_losing || "",
          pct_access_lost: routesBefore > 0 ? routesLosing / routesBefore : 0,
          access_metric: useStreet ? "street" : "all_stops",
        });
      });

      const povertyForCuts = [];
      for (const f of hoodGeo.features) {
        const hood = f.properties?.hood || "";
        const awater = safeFloat(f.properties?.awater10);
        const aland = safeFloat(f.properties?.aland10);
        const waterHeavy = awater > 0 && aland === 0;
        if (waterHeavy) continue;
        const m = hoodByName.get(hood);
        if (m) povertyForCuts.push(m.poverty_rate);
      }
      const povertyCuts = povertyTercileCuts(povertyForCuts);

      hoodGeo.features = hoodGeo.features.map((f) => {
        const hood = f.properties?.hood || "";
        const m = hoodByName.get(hood) || {};
        const awater = safeFloat(f.properties?.awater10);
        const aland = safeFloat(f.properties?.aland10);
        const waterHeavy = awater > 0 && aland === 0;
        const poverty_rate = m.poverty_rate ?? 0;
        const poverty_bucket = waterHeavy ? 0 : povertyColorBucket(poverty_rate, povertyCuts);
        return {
          ...f,
          properties: {
            ...f.properties,
            neighborhood_name: hood,
            pct_no_car: m.pct_no_car ?? 0,
            poverty_rate,
            pct_transit_dependent: m.pct_transit_dependent ?? 0,
            routes_cut_or_reduced: m.routes_cut_or_reduced ?? "",
            pct_access_lost: m.pct_access_lost ?? 0,
            access_metric: m.access_metric ?? "all_stops",
            poverty_bucket,
            is_water: waterHeavy ? 1 : 0,
            is_featured: FEATURED_HOODS.has(hood) ? 1 : 0,
          },
        };
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
      } else {
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
      }

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
        map.addSource("hoods", { type: "geojson", data: hoodGeo });

        map.addLayer({
          id: "hood-fill",
          type: "fill",
          source: "hoods",
          paint: HOOD_FILL_PAINT,
        });

        map.addLayer({
          id: "hood-featured-outline",
          type: "line",
          source: "hoods",
          filter: ["==", ["get", "is_featured"], 1],
          paint: HOOD_FEATURED_OUTLINE_PAINT,
        });
        map.addLayer({
          id: "hood-hover-outline",
          type: "line",
          source: "hoods",
          filter: ["==", ["get", "neighborhood_name"], ""],
          paint: HOOD_HOVER_OUTLINE_PAINT,
        });

        /* Routes above neighborhood fills/outlines so lines stay legible */
        if (routeGeo?.features?.length) {
          map.addSource("routes", { type: "geojson", data: routeGeo });
          map.addLayer({
            id: "routes-after-eliminated",
            type: "line",
            source: "routes",
            filter: ["==", ["get", "route_visual"], ROUTE_VISUAL.elimination],
            paint: ROUTES_ELIMINATED_PAINT,
          });
          map.addLayer({
            id: "routes-after",
            type: "line",
            source: "routes",
            filter: ["!=", ["get", "route_visual"], ROUTE_VISUAL.elimination],
            paint: ROUTES_AFTER_DETAILED_PAINT,
          });
          map.addLayer({
            id: "routes-before",
            type: "line",
            source: "routes",
            paint: ROUTES_BEFORE_PAINT,
            layout: { visibility: "none" },
          });
        }

        map.on("mousemove", "hood-fill", (e) => {
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
          });
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], p.neighborhood_name]);
        });

        map.on("mouseleave", "hood-fill", () => {
          setHoverData(null);
          map.setFilter("hood-hover-outline", ["==", ["get", "neighborhood_name"], ""]);
        });

        const ui = routeUiRef.current;
        syncRouteLayersAfterState(map, ui.mode, ui.simpleMode);

        const syncMinZoomToHomeView = () => {
          if (mapRef.current !== map) return;
          map.setMinZoom(map.getZoom());
        };

        const landFeatures = hoodGeo.features.filter((f) => Number(f.properties?.is_water) !== 1);
        try {
          if (landFeatures.length) {
            const b = turf.bbox({ type: "FeatureCollection", features: landFeatures });
            if (b.every(Number.isFinite)) {
              map.fitBounds(
                [
                  [b[0], b[1]],
                  [b[2], b[3]],
                ],
                {
                  padding: { top: 28, bottom: 28, left: 24, right: 24 },
                  duration: 0,
                  maxZoom: 11.5,
                },
              );
            }
          }
        } catch {
          /* no-op */
        }
        map.once("moveend", syncMinZoomToHomeView);
        requestAnimationFrame(syncMinZoomToHomeView);
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    syncRouteLayersAfterState(map, mode, simpleMode);
  }, [mode, simpleMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getLayer("hood-fill")) return;
    if (!showHighDependencyOnly) {
      map.setFilter("hood-fill", null);
      map.setFilter("hood-featured-outline", ["==", ["get", "is_featured"], 1]);
      return;
    }
    const filter = [
      "all",
      ["==", ["to-number", ["get", "poverty_bucket"]], HOOD_POVERTY_BUCKET_HIGH],
      [">=", ["get", "pct_access_lost"], ACCESS_LOSS_THRESHOLD],
    ];
    map.setFilter("hood-fill", filter);
    map.setFilter("hood-featured-outline", ["all", ["==", ["get", "is_featured"], 1], filter]);
  }, [showHighDependencyOnly]);

  if (!token) {
    return (
      <section className={styles.equityMapPanel}>
        <p>
          Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in your environment to render the map.
        </p>
      </section>
    );
  }

  return (
    <section className={styles.equityMapGrid}>
      <div className={styles.equityControls}>
        <div className={styles.controlGroup}>
          <span>Route view</span>
          <button
            className={`${styles.controlButton} ${mode === "before" ? styles.controlButtonActive : ""}`}
            onClick={() => setMode("before")}
            type="button"
          >
            Before
          </button>
          <button
            className={`${styles.controlButton} ${mode === "after" ? styles.controlButtonActive : ""}`}
            onClick={() => setMode("after")}
            type="button"
          >
            After
          </button>
        </div>
        <div className={styles.controlCheckStack}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={simpleMode}
              onChange={(e) => setSimpleMode(e.target.checked)}
            />
            Simple mode (no elimination lines; reduced routes = medium grey solid)
          </label>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={showHighDependencyOnly}
              onChange={(e) => setShowHighDependencyOnly(e.target.checked)}
            />
            Show only high poverty (top tertile) and ≥
            {(ACCESS_LOSS_THRESHOLD * 100).toFixed(0)}% route access lost
          </label>
        </div>
      </div>

      <div className={styles.legendStrip} aria-label="Map legend">
        <div className={styles.legendTitleRow}>
          <div className={styles.legendTitle}>Neighborhood fill (poverty tertiles)</div>
          <DataRationaleIcon
            label="How neighborhood poverty bands are defined"
            rationale={
              "Among land neighborhoods in this map, poverty rate (ACS share below poverty) is split into tertiles: low, moderate, and high. Colors match the poverty palette on the dot map. Water-only areas use a neutral grey."
            }
          />
        </div>
        <div className={styles.legendSwatches} role="list">
          <span className={styles.legendSwatch} role="listitem">
            <span className={styles.legendSwatchColor} style={{ background: POVERTY_LEVEL_COLORS[2] }} />
            High (top tertile)
          </span>
          <span className={styles.legendSwatch} role="listitem">
            <span className={styles.legendSwatchColor} style={{ background: POVERTY_LEVEL_COLORS[1] }} />
            Moderate (middle tertile)
          </span>
          <span className={styles.legendSwatch} role="listitem">
            <span className={styles.legendSwatchColor} style={{ background: POVERTY_LEVEL_COLORS[0] }} />
            Low (bottom tertile)
          </span>
          <span className={styles.legendSwatch} role="listitem">
            <span className={styles.legendSwatchColor} style={{ background: WATER_FILL }} />
            Water (if present)
          </span>
        </div>
        {simpleMode ? (
          <>
            <div className={styles.legendTitleRow}>
              <p className={styles.legendNoteInline}>Simple mode: only no-impact vs any reduction; eliminated routes hidden.</p>
            </div>
            <div className={styles.legendTitleRow}>
              <div className={styles.legendTitle}>Routes after cuts (simple)</div>
              <DataRationaleIcon
                label="How route lines are styled after cuts"
                rationale={
                  "All lines are solid (no dashes). No-change routes are black. Any service reduction is medium grey. Eliminated alignments are hidden in this mode."
                }
              />
            </div>
            <ul className={styles.legendList}>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_NO_CHANGE_BLACK, opacity: 1 }}
                />{" "}
                No change (black)
              </li>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_REDUCED_MEDIUM_GREY, opacity: 1 }}
                />{" "}
                Any reduction (medium grey)
              </li>
            </ul>
          </>
        ) : (
          <>
            <div className={styles.legendTitleRow}>
              <div className={styles.legendTitle}>Routes — after cuts</div>
              <DataRationaleIcon
                label="How route lines are styled after cuts"
                rationale={
                  "Solid lines only; shade indicates status. Black = no FY26 change. Darker greys = different reduction types (frequency/stops vs span vs alignment). Lightest grey = eliminated segment, drawn beneath active lines so context remains visible."
                }
              />
            </div>
            <ul className={styles.legendList}>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_NO_CHANGE_BLACK, opacity: 1 }}
                />{" "}
                No change (black)
              </li>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_REDUCED_DARK_GREY, opacity: 1 }}
                />{" "}
                Reduced (major frequency / stops)
              </li>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_REDUCED_MID_GREY, opacity: 1 }}
                />{" "}
                Reduced (late-night / span)
              </li>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_REDUCED_STONE_GREY, opacity: 1 }}
                />{" "}
                Reduced (alignment + span)
              </li>
              <li>
                <span
                  className={styles.legendLineSwatchM}
                  style={{ background: ROUTE_ELIMINATED_LIGHT_GREY, opacity: 1 }}
                />{" "}
                Eliminated — light grey (under other routes)
              </li>
            </ul>
          </>
        )}
      </div>

      <div className={styles.equityMapWrap} ref={mapContainerRef} />

      <aside className={styles.equitySidepanel} aria-label="Neighborhood metrics">
        {hoverData ? (
          <dl>
            <dt>Name</dt>
            <dd>{hoverData.name}</dd>
            <dt className={styles.metricDt}>
              % workers relying on PRT for commute
              <DataRationaleIcon
                label="About transit commute share"
                rationale="ACS: share of workers in this neighborhood who commute by public transit (PRT and other regional transit)."
              />
            </dt>
            <dd>
              <span className={styles.metricValue}>{(hoverData.pctWorkersTransitCommute * 100).toFixed(1)}%</span>
            </dd>
            <dt className={styles.metricDt}>
              Poverty rate
              <DataRationaleIcon
                label="About poverty rate"
                rationale="ACS: share of residents below the federal poverty line. Drives neighborhood fill tertiles on this map."
              />
            </dt>
            <dd>
              <span className={styles.metricValue}>{(hoverData.povertyRate * 100).toFixed(1)}%</span>
            </dd>
            <dt>Routes cut/reduced</dt>
            <dd>{hoverData.routesCut || "None listed"}</dd>
            <dt className={styles.metricDt}>
              % route access lost
              <DataRationaleIcon
                label="About percent route access lost"
                rationale={
                  hoverData.accessMetric === "street"
                    ? "Share of street-served routes touching this neighborhood that are cut or reduced under FY26 (non-busway stops only; excludes East/West Busway platform-only service)."
                    : "Share of all routes with a stop in this neighborhood that are cut or reduced under FY26, including busway platforms where applicable."
                }
              />
            </dt>
            <dd>
              <span className={styles.metricValue}>{(hoverData.pctAccessLost * 100).toFixed(1)}%</span>
            </dd>
          </dl>
        ) : null}
        {routesFileMissing && (
          <p className={styles.warn}>
            Route overlay inactive: add <code>data/route_lines_current.geojson</code> with route IDs
            to enable lines.
          </p>
        )}
      </aside>
    </section>
  );
}
