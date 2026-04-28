"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { bearing, centroid, distance, point } from "@turf/turf";
import { dataAssetUrl } from "../../lib/dataAssetUrl";
import { useNeighborhoodPanel } from "../../contexts/NeighborhoodPanelContext";
import { normalizeRouteId } from "../../lib/equity-map/constants";
import {
  addGroupKeysToRoutesMap,
  buildGroupedCoverageFeatures,
  buildHoodToGroupNameMap,
} from "../../lib/coverageHoodGroups";
import {
  buildHoverPayload,
  computeNeighborhoodRouteStats,
  mergeDisplayAndNProfiles,
  normalizeStatus,
  pickRouteStatusValue,
  parseRouteList,
} from "../../lib/neighborhoodPanelPayload";
import styles from "./RadialNetworkMapView.module.css";

const DOT_SPEED_PX_PER_SEC = 8;
const DOT_RADIUS = 2.2;
const BEFORE_SPACING = 120;
const AFTER_SPACING_UNCHANGED = 1000;
const AFTER_SPACING_REDUCED = 2000;
const MAX_DOTS_PER_ROUTE = 6;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.15;

function parseCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    const fatal = parsed.errors.find((e) => e.type !== "Quotes" && e.type !== "FieldMismatch");
    if (fatal) throw new Error(fatal.message);
  }
  return parsed.data;
}

function povertyTone(poverty, palette) {
  if (poverty > 0.35) return palette.deep;
  if (poverty > 0.2) return palette.poverty;
  return palette.high;
}

export default function RadialNetworkMapView() {
  const { setRepresentationalHoverPanel } = useNeighborhoodPanel();
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [error, setError] = useState("");
  const [palette, setPalette] = useState({ high: "#bfd0aa", poverty: "#d85c4d", deep: "#b94033" });
  const [routeDotColor, setRouteDotColor] = useState("#86868a");
  const [dotMode, setDotMode] = useState("before");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const subtitle =
    "Toggle before and after to see the frequency difference to downtown, hover neighborhoods to see demographic data, and click to focus on one.";
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const layoutRef = useRef([]);
  const widthRef = useRef(760);
  const [width, setWidth] = useState(760);
  const [tickMs, setTickMs] = useState(0);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const root = getComputedStyle(document.documentElement);
    setPalette({
      high: root.getPropertyValue("--color-fill-positive").trim() || "#bfd0aa",
      poverty: root.getPropertyValue("--color-fill-neg2").trim() || "#d85c4d",
      deep: root.getPropertyValue("--color-fill-neg3").trim() || "#b94033",
    });
    setRouteDotColor(root.getPropertyValue("--n4").trim() || "#86868a");
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(dataAssetUrl("route_status_official.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("display_profiles_2024.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
    ])
      .then(([statusRaw, displayRaw, nprofRaw, hoodGeo]) => {
        if (cancelled) return;
        const statusRows = parseCsv(statusRaw);
        const displayRows = parseCsv(displayRaw);
        const nprofRows = parseCsv(nprofRaw);
        const profiles = mergeDisplayAndNProfiles(displayRows);

        const hoodSet = new Set(
          (hoodGeo.features || []).map((f) => String(f?.properties?.hood || "").trim()).filter(Boolean),
        );
        const hoodToGroup = buildHoodToGroupNameMap(displayRows, hoodSet);
        const groupedFeatures = buildGroupedCoverageFeatures(hoodGeo.features || [], hoodToGroup);

        const routesByNeighborhood = new Map();
        for (const row of nprofRows) {
          const hood = String(row.neighborhood || row.hood || "").trim();
          if (!hood) continue;
          if (!routesByNeighborhood.has(hood)) routesByNeighborhood.set(hood, new Set());
          for (const rid of parseRouteList(row.routes_before)) routesByNeighborhood.get(hood).add(rid);
        }
        addGroupKeysToRoutesMap(routesByNeighborhood, hoodToGroup);

        const statusByRoute = new Map();
        const reductionTierByRoute = new Map();
        for (const row of statusRows) {
          const id = normalizeRouteId(
            row.route_code || row.route_label || row["#"] || row.Sort || row["Route name:"] || "",
          );
          if (!id) continue;
          statusByRoute.set(id, normalizeStatus(pickRouteStatusValue(row)));
          reductionTierByRoute.set(id, row?.reduction_tier || row?.["Reduction Tier"] || "");
        }

        const downtownFeature = groupedFeatures.find(
          (f) => String(f?.properties?.neighborhood_name || "").trim() === "Central Business District",
        );
        const downtown = downtownFeature ? centroid(downtownFeature).geometry.coordinates : [-79.9959, 40.4406];

        setNodes(
          groupedFeatures.map((f) => {
            const name = String(f?.properties?.neighborhood_name || "").trim();
            const c = centroid(f).geometry.coordinates;
            const profile = profiles.get(name.toLowerCase()) || {};
            const routes = Array.from(routesByNeighborhood.get(name) || []).sort((a, b) =>
              String(a).localeCompare(String(b), undefined, { numeric: true }),
            );
            const routeStats = computeNeighborhoodRouteStats(
              name,
              new Set(routes),
              statusByRoute,
              reductionTierByRoute,
            );
            const routeStatusCounts = routes.reduce(
              (acc, id) => {
                const st = statusByRoute.get(id) || "unchanged";
                if (st === "eliminated") acc.eliminated += 1;
                else if (st === "reduced") acc.reduced += 1;
                else acc.unchanged += 1;
                return acc;
              },
              { unchanged: 0, reduced: 0, eliminated: 0 },
            );
            return {
              name,
              isDowntown: name === "Central Business District",
              population: Number(profile.total_pop || 0),
              poverty: Number(profile.share_below_100pct_poverty_threshold || 0),
              bearingDeg: bearing(point(downtown), point(c)),
              distanceKm: distance(point(downtown), point(c), { units: "kilometers" }),
              panelPayload: {
                ...buildHoverPayload(routeStats, profiles),
                routesLeadLabel: "Routes serving downtown",
                routeAffectedSummary: routeStatusCounts,
              },
              routes: routes.map((id) => {
                return {
                  id,
                  status: statusByRoute.get(id) || "unchanged",
                  reductionTier: reductionTierByRoute.get(id) || "",
                };
              }),
            };
          }),
        );
      })
      .catch((e) => !cancelled && setError(String(e?.message || e)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const activeName = selected || hovered;
    if (!activeName) {
      setRepresentationalHoverPanel(null);
      return;
    }
    const payload = nodes.find((n) => n.name === activeName)?.panelPayload || null;
    setRepresentationalHoverPanel(payload);
  }, [hovered, selected, nodes, setRepresentationalHoverPanel]);

  useEffect(() => () => setRepresentationalHoverPanel(null), [setRepresentationalHoverPanel]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect?.width || 760);
      if (next > 0 && Math.abs(next - widthRef.current) >= 4) {
        widthRef.current = next;
        setWidth(next);
      }
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let rafId = 0;
    const run = (ts) => {
      setTickMs(ts);
      rafId = window.requestAnimationFrame(run);
    };
    rafId = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !nodes.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const wrapHeight = Math.floor(wrapRef.current?.clientHeight || 0);
    const targetHeight = Math.max(320, wrapHeight || Math.round((560 / 680) * width));
    const drawWidth = Math.min(width, Math.round((680 / 560) * targetHeight));
    const h = Math.max(320, Math.round((560 / 680) * drawWidth));
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(drawWidth * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, h);

    const cx = drawWidth / 2 + pan.x;
    const cy = h / 2 + pan.y;
    const maxPop = Math.max(1, ...nodes.map((n) => n.population || 0));
    const dd = nodes.filter((n) => !n.isDowntown).map((n) => Math.max(0, n.distanceKm || 0));
    const maxDistanceKm = Math.max(1, ...dd);
    const minDim = Math.min(drawWidth, h);
    const minRingRadius = minDim * 0.12 * zoomLevel;
    const maxRingRadius = minDim * 0.43 * zoomLevel;
    const distanceToRadius = (dKm) => {
      const clamped = Math.max(0, Math.min(maxDistanceKm, Number(dKm) || 0));
      return minRingRadius + (clamped / maxDistanceKm) * (maxRingRadius - minRingRadius);
    };

    // Draw guideline rings behind nodes so distance from downtown is legible.
    const guideRingCount = 4;
    const root = getComputedStyle(document.documentElement);
    const labelFontSize = root.getPropertyValue("--size-xs").trim() || "0.75rem";
    const labelFontFamily = root.getPropertyValue("--font-mono").trim() || "monospace";
    const labelFontWeight = root.getPropertyValue("--weight-regular").trim() || "400";
    const labelLetterSpacing = 0.08;
    ctx.save();
    ctx.strokeStyle = "#9ba1a6";
    ctx.fillStyle = "#5a6066";
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.font = `${labelFontWeight} ${labelFontSize} ${labelFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= guideRingCount; i += 1) {
      const t = i / guideRingCount;
      const radius = minRingRadius + t * (maxRingRadius - minRingRadius);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const laidOut = nodes.map((n) => {
      if (n.isDowntown) return { ...n, x: cx, y: cy, radius: 18, color: "#134948", opacity: 1 };
      const r = distanceToRadius(n.distanceKm || 0);
      const a = (Number(n.bearingDeg) || 0) * (Math.PI / 180);
      return {
        ...n,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r,
        // Linear scaling: radius is directly proportional to population share.
        radius: (5 + (Math.max(0, n.population || 0) / maxPop) * 28) * zoomLevel,
        color: povertyTone(n.poverty, palette),
        opacity: Math.max(0.25, Math.min(0.95, Number(n.poverty) || 0)),
      };
    });
    layoutRef.current = laidOut;

    // Place km labels at low-overlap points around each ring.
    const labelAngles = [-90, -35, 20, 70, 145, 210];
    ctx.save();
    ctx.fillStyle = "#5a6066";
    ctx.globalAlpha = 0.75;
    ctx.font = `${labelFontWeight} ${labelFontSize} ${labelFontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= guideRingCount; i += 1) {
      const t = i / guideRingCount;
      const radius = minRingRadius + t * (maxRingRadius - minRingRadius);
      let best = { x: cx, y: cy + radius + 12, score: -Infinity };
      for (const deg of labelAngles) {
        const rad = (deg * Math.PI) / 180;
        const x = cx + Math.cos(rad) * (radius + 12);
        const y = cy + Math.sin(rad) * (radius + 12);
        const minClearance = laidOut.reduce((m, n) => {
          const d = Math.hypot(x - n.x, y - n.y) - n.radius;
          return Math.min(m, d);
        }, Number.POSITIVE_INFINITY);
        if (minClearance > best.score) best = { x, y, score: minClearance };
      }
      const labelKm = `${(t * maxDistanceKm).toFixed(1)} KM`;
      if ("letterSpacing" in ctx) {
        ctx.letterSpacing = `${labelLetterSpacing}em`;
      }
      ctx.fillText(labelKm, best.x, best.y);
    }
    ctx.restore();

    const hasSelection = Boolean(selected);
    for (const n of laidOut) {
      if (n.isDowntown) continue;
      let alpha = 0.28;
      let lw = 1;
      let stroke = povertyTone(n.poverty, palette);
      if (hasSelection) {
        if (n.name === selected) {
          alpha = 1;
          lw = 2;
        } else {
          alpha = 0.16;
          stroke = "#b8b8b8";
        }
      } else if (hovered === n.name) {
        alpha = 0.55;
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = stroke;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const drawRouteDots = (node, route, routeIdx, lane) => {
      const dx = cx - node.x;
      const dy = cy - node.y;
      const lineLen = Math.hypot(dx, dy);
      if (lineLen < 12) return;
      const ux = dx / lineLen;
      const uy = dy / lineLen;

      const before = lane === "before";
      if (!before && route.status === "eliminated") return;
      const spacing = before
        ? BEFORE_SPACING
        : route.status === "reduced"
          ? AFTER_SPACING_REDUCED
          : AFTER_SPACING_UNCHANGED;
      const dotCount = Math.min(MAX_DOTS_PER_ROUTE, Math.ceil(lineLen / spacing) + 1);
      const phase = ((tickMs / 1000) * DOT_SPEED_PX_PER_SEC + routeIdx * 7.5) % spacing;

      ctx.save();
      ctx.fillStyle = routeDotColor;
      ctx.globalAlpha = 1;
      for (let i = 0; i < dotCount; i += 1) {
        const d = (phase + i * spacing) % lineLen;
        const x = node.x + ux * d;
        const y = node.y + uy * d;
        ctx.beginPath();
        ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    for (const n of laidOut) {
      if (n.isDowntown) continue;
      if (hasSelection && n.name !== selected) continue;
      for (let i = 0; i < n.routes.length; i += 1) {
        const route = n.routes[i];
        drawRouteDots(n, route, i, dotMode);
      }
    }

    for (const n of laidOut) {
      const isHover = hovered === n.name;
      const isSelected = selected === n.name;
      const isGrey = hasSelection && !isSelected;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = isGrey ? "#b8b8b8" : n.color;
      ctx.globalAlpha = 1;
      ctx.fill();
      if (isHover || isSelected) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "#121212";
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }, [nodes, width, hovered, selected, palette, tickMs, dotMode, routeDotColor, zoomLevel, pan]);

  const hit = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    for (let i = layoutRef.current.length - 1; i >= 0; i -= 1) {
      const n = layoutRef.current[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (dx * dx + dy * dy <= n.radius * n.radius) return n;
    }
    return null;
  };

  return (
    <section className={styles.section} aria-label="Radial neighborhood transit network">
      <div className={styles.inner}>
        <p className={`${styles.lede} type-body text-ink-secondary`}>{subtitle}</p>
        {error ? <p className={`${styles.tokenMissing} type-body text-ink-secondary`}>{error}</p> : null}
      </div>
      <div className={styles.mapWrap} ref={wrapRef}>
        <div className={styles.mapTopLeftControls}>
          <div className={styles.modeControls} role="group" aria-label="Route dot state">
            <button
              type="button"
              className={`${styles.modeButton} ${dotMode === "before" ? styles.modeButtonOn : ""} type-h4-mono-allcaps`}
              onClick={() => setDotMode("before")}
            >
              Before
            </button>
            <button
              type="button"
              className={`${styles.modeButton} ${dotMode === "after" ? styles.modeButtonOn : ""} type-h4-mono-allcaps`}
              onClick={() => setDotMode("after")}
            >
              After
            </button>
          </div>
          <div className={styles.zoomControls} role="group" aria-label="Radial network zoom">
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => setZoomLevel((z) => Math.max(ZOOM_MIN, Number((z - ZOOM_STEP).toFixed(2))))}
              disabled={zoomLevel <= ZOOM_MIN}
              aria-label="Zoom out"
              title="Zoom out"
            >
              -
            </button>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => setZoomLevel((z) => Math.min(ZOOM_MAX, Number((z + ZOOM_STEP).toFixed(2))))}
              disabled={zoomLevel >= ZOOM_MAX}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>
        <div className={styles.mapBottomLeftLegend}>
          <div className={styles.povertyLegend} aria-label="Poverty key">
            <div className={styles.povertyLegendBar} aria-hidden />
            <div className={styles.povertyLegendLabels}>
              <span className="type-h4-mono-allcaps text-ink-default">Low poverty share</span>
              <span className="type-h4-mono-allcaps text-ink-default">High poverty share</span>
            </div>
          </div>
        </div>
        {nodes.length ? (
          <div className={styles.canvasWrap}>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              role="img"
              aria-label="Radial neighborhood network"
              onPointerDown={(e) => {
                isDraggingRef.current = true;
                dragMovedRef.current = false;
                dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
                e.currentTarget.setPointerCapture?.(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (isDraggingRef.current) {
                  const dx = e.clientX - dragStartRef.current.x;
                  const dy = e.clientY - dragStartRef.current.y;
                  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMovedRef.current = true;
                  setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
                  setTooltip(null);
                  return;
                }
                if (selected) return;
                const n = hit(e.clientX, e.clientY);
                setHovered(n ? n.name : null);
                setTooltip(n ? { x: e.clientX, y: e.clientY, text: n.name } : null);
              }}
              onPointerUp={(e) => {
                const moved = dragMovedRef.current;
                isDraggingRef.current = false;
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                if (moved) return;
                const n = hit(e.clientX, e.clientY);
                if (!n) {
                  setSelected(null);
                  return;
                }
                setSelected((prev) => (prev === n.name ? null : n.name));
              }}
              onPointerCancel={() => {
                isDraggingRef.current = false;
              }}
              onMouseLeave={() => {
                if (!selected) setHovered(null);
                setTooltip(null);
              }}
            />
            {tooltip ? (
              <div className={`${styles.tooltip} type-h4-mono-allcaps`} style={{ left: tooltip.x, top: tooltip.y }}>
                {tooltip.text}
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`${styles.tokenMissing} type-body text-ink-secondary`}>Loading neighborhood network...</div>
        )}

      </div>
    </section>
  );
}
