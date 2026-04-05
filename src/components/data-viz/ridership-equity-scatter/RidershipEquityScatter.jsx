"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import styles from "./RidershipEquityScatter.module.css";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";

const COLORS = {
  eliminated: "#E24B4A",
  reduced: "#EF9F27",
  unchanged: "#888780",
};

const DEFAULT_DATA_URL = dataAssetUrl("routes_with_demographics.csv");

/** @typedef {{ route_id: string; route_name: string; avg_daily_riders: number; pct_corridor_no_car: number; cut_type: 'eliminated'|'reduced'|'unchanged'; neighborhoods_served: string; is_persona_a_route: boolean; is_persona_b_route: boolean }} RouteRow */

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseBool(v) {
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/**
 * @param {Record<string, string>} row
 * @returns {RouteRow | null}
 */
function parseRouteRow(row) {
  const route_id = (row.route_id || "").trim();
  if (!route_id) return null;
  const ct = (row.cut_type || "").trim().toLowerCase();
  if (ct !== "eliminated" && ct !== "reduced" && ct !== "unchanged") return null;
  return {
    route_id,
    route_name: (row.route_name || route_id).trim(),
    avg_daily_riders: safeFloat(row.avg_daily_riders, 0),
    pct_corridor_no_car: safeFloat(row.pct_corridor_no_car, 0),
    cut_type: /** @type {'eliminated'|'reduced'|'unchanged'} */ (ct),
    neighborhoods_served: (row.neighborhoods_served || "").trim(),
    is_persona_a_route: parseBool(row.is_persona_a_route),
    is_persona_b_route: parseBool(row.is_persona_b_route),
  };
}

function median(nums) {
  const a = [...nums].sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/**
 * @param {RouteRow[]} rows
 */
function assessQuadrantPattern(rows) {
  if (rows.length < 8) {
    return {
      showCaution: true,
      message:
        "Too few routes to judge quadrant clustering. Treat any visual pattern as preliminary.",
    };
  }
  const mx = median(rows.map((r) => r.avg_daily_riders));
  const my = median(rows.map((r) => r.pct_corridor_no_car));

  /** @param {RouteRow} r */
  function q(r) {
    const left = r.avg_daily_riders < mx;
    const high = r.pct_corridor_no_car > my;
    if (left && high) return "UL";
    if (!left && high) return "UR";
    if (left && !high) return "LL";
    return "LR";
  }

  const elim = rows.filter((r) => r.cut_type === "eliminated");
  if (!elim.length) {
    return { showCaution: true, message: "No eliminated routes in this extract; cut-status comparison is limited." };
  }

  /** @type {Record<string, number>} */
  const counts = { UL: 0, UR: 0, LL: 0, LR: 0 };
  for (const r of elim) {
    counts[q(r)] += 1;
  }
  const dominant = /** @type {const} */ (["UL", "UR", "LL", "LR"].sort((a, b) => counts[b] - counts[a])[0]);
  const ulShare = counts.UL / elim.length;
  const llShare = counts.LL / elim.length;

  const allUl = rows.filter((r) => q(r) === "UL").length / rows.length;

  if (dominant !== "UL" || ulShare < allUl * 1.05) {
    const quadLabel =
      dominant === "LL"
        ? "lower-left (below median ridership and below the y-axis median)"
        : dominant === "LR"
          ? "lower-right"
          : dominant === "UR"
            ? "upper-right"
            : "upper-left";
    return {
      showCaution: true,
      message: `With median-split quadrants on this file, eliminated routes are most common in the ${quadLabel} (${Math.round(llShare * 100)}% in lower-left vs ${Math.round(ulShare * 100)}% in upper-left). That does not match a simple “high car-free need, low ridership” corner story on this y-axis definition—avoid implying this plot alone proves that pattern.`,
    };
  }

  return {
    showCaution: false,
    message: null,
  };
}

/**
 * @param {object} props
 * @param {string} [props.dataUrl]
 * @param {RouteRow[] | null} [props.routes]
 * @param {boolean} [props.animated=true]
 * @param {string} [props.title]
 * @param {string | null} [props.subtitle]
 */
export function RidershipEquityScatter({
  dataUrl = DEFAULT_DATA_URL,
  routes: routesProp = null,
  animated = true,
  title = "Ridership vs. corridor car access (FY26 anchors)",
  subtitle = null,
}) {
  const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [loaded, setLoaded] = useState(/** @type {RouteRow[] | null} */ (routesProp));
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [entered, setEntered] = useState(!animated);
  const [tip, setTip] = useState(/** @type {{ x: number; y: number; row: RouteRow } | null} */ (null));
  const [visibleCount, setVisibleCount] = useState(!animated ? 9999 : 0);

  useEffect(() => {
    if (routesProp) {
      setLoaded(routesProp);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    fetch(dataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load scatter data (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = [];
        for (const row of data) {
          const p = parseRouteRow(row);
          if (p) rows.push(p);
        }
        setLoaded(rows.length ? rows : null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load data");
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl, routesProp]);

  useEffect(() => {
    if (!animated) {
      setEntered(true);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setEntered(true);
      },
      { root: null, rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animated]);

  const sorted = useMemo(() => {
    if (!loaded) return [];
    return [...loaded].sort((a, b) => a.avg_daily_riders - b.avg_daily_riders || a.route_id.localeCompare(b.route_id));
  }, [loaded]);

  useEffect(() => {
    if (!entered || !sorted.length) {
      if (!animated) setVisibleCount(sorted.length);
      return;
    }
    if (!animated) {
      setVisibleCount(sorted.length);
      return;
    }
    setVisibleCount(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setVisibleCount(i);
      if (i >= sorted.length) window.clearInterval(t);
    }, 20);
    return () => window.clearInterval(t);
  }, [entered, sorted, animated]);

  const layout = useMemo(() => {
    if (!sorted.length) return null;
    const xs = sorted.map((r) => r.avg_daily_riders);
    const ys = sorted.map((r) => r.pct_corridor_no_car);
    const xMax = Math.max(...xs) * 1.06;
    const xMin = 0;
    const yMin = Math.max(0, Math.min(...ys) * 0.94);
    const yMax = Math.min(100, Math.max(...ys) * 1.06);
    return { xMin, xMax, yMin, yMax };
  }, [sorted]);

  const pattern = useMemo(() => (sorted.length ? assessQuadrantPattern(sorted) : { showCaution: false, message: null }), [sorted]);

  const W = 720;
  const H = 420;
  const padL = 52;
  const padR = 24;
  const padT = 28;
  const padB = 56;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const sx = useCallback(
    (x) => {
      if (!layout) return 0;
      const { xMin, xMax } = layout;
      return padL + ((x - xMin) / (xMax - xMin || 1)) * innerW;
    },
    [layout, innerW, padL],
  );

  const sy = useCallback(
    (y) => {
      if (!layout) return 0;
      const { yMin, yMax } = layout;
      return padT + innerH - ((y - yMin) / (yMax - yMin || 1)) * innerH;
    },
    [layout, innerH, padT],
  );

  const onPointMove = useCallback((e, row) => {
    setTip({ x: e.clientX, y: e.clientY, row });
  }, []);

  const onPointLeave = useCallback(() => setTip(null), []);

  const cutLabel = useCallback((c) => {
    if (c === "eliminated") return "Eliminated";
    if (c === "reduced") return "Reduced";
    return "Unchanged";
  }, []);

  const defaultSubtitle =
    "Y-axis is 100% minus the share of workers commuting by car, truck, or van in each route’s FY26 ACS anchor geography (from `FY26_route_status_all.csv`). It proxies low car commute reliance along that anchor, not ACS zero-vehicle households or a tract-buffer corridor join.";

  return (
    <div ref={rootRef} className={styles.wrap}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <p className={styles.subtitle}>{subtitle ?? defaultSubtitle}</p>

      {loadError ? (
        <p className={styles.loading} role="alert">
          {loadError}
        </p>
      ) : null}
      {!loadError && !loaded ? <p className={styles.loading}>Loading…</p> : null}
      {loaded && !sorted.length ? <p className={styles.loading}>No routes to plot.</p> : null}

      {sorted.length > 0 && layout ? (
        <div className={styles.mainGrid}>
          <div className={styles.vizColumn}>
            <div className={styles.chartFrame}>
            <svg
              className={styles.svg}
              viewBox={`0 0 ${W} ${H}`}
              role="img"
              aria-label="Scatter of average weekday ridership versus corridor car-access proxy, colored by FY26 cut status."
            >
              <rect x={padL} y={padT} width={innerW} height={innerH} fill="#fafaf9" rx={4} />

              <text
                x={padL + innerW * 0.02}
                y={padT + innerH * 0.12}
                className={styles.quadrantLabel}
                textAnchor="start"
              >
                High need, lower ridership — most eliminated
              </text>
              <text
                x={padL + innerW * 0.98}
                y={padT + innerH * 0.92}
                className={styles.quadrantLabel}
                textAnchor="end"
              >
                Lower need, higher ridership — mostly retained
              </text>

              <line
                className={styles.refLine}
                x1={sx(layout.xMax)}
                y1={sy(layout.yMin)}
                x2={sx(layout.xMin)}
                y2={sy(layout.yMax)}
              />

              <text
                x={padL + innerW * 0.28}
                y={padT + innerH * 0.22}
                className={styles.refLabel}
                textAnchor="start"
              >
                PRT cuts routes here →
              </text>

              {sorted.map((r, i) => {
                const cx = sx(r.avg_daily_riders);
                const cy = sy(r.pct_corridor_no_car);
                const color = COLORS[r.cut_type];
                const persona = r.is_persona_a_route || r.is_persona_b_route;
                const rPoint = persona ? 12 : 8;
                const show = i < visibleCount;
                const label =
                  r.is_persona_a_route && r.is_persona_b_route
                    ? "A & B"
                    : r.is_persona_a_route
                      ? "Persona A"
                      : r.is_persona_b_route
                        ? "Persona B"
                        : "";

                return (
                  <g key={r.route_id} className={`${styles.point} ${show ? "" : styles.pointDim}`}>
                    {persona ? (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={rPoint + 3}
                        fill="none"
                        stroke="rgba(28,25,23,0.55)"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                    <circle cx={cx} cy={cy} r={rPoint} fill={color} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
                    {label ? (
                      <text x={cx + rPoint + 5} y={cy + 3} className={styles.personaLabel}>
                        {label}
                      </text>
                    ) : null}
                    <circle
                      role="presentation"
                      className={styles.pointHit}
                      cx={cx}
                      cy={cy}
                      r={Math.max(rPoint + 8, 16)}
                      onMouseMove={(e) => onPointMove(e, r)}
                      onMouseLeave={onPointLeave}
                    />
                  </g>
                );
              })}

              <line
                x1={padL}
                y1={padT + innerH}
                x2={padL + innerW}
                y2={padT + innerH}
                stroke="#a8a29e"
                strokeWidth={1}
              />
              <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} stroke="#a8a29e" strokeWidth={1} />

              <text x={padL + innerW / 2} y={H - 14} textAnchor="middle" className={styles.axisLabel}>
                Average daily riders
              </text>
              <text
                x={16}
                y={padT + innerH / 2}
                textAnchor="middle"
                className={styles.axisLabel}
                transform={`rotate(-90, 16, ${padT + innerH / 2})`}
              >
                % households without a car (route corridor)
              </text>
            </svg>
            </div>
          </div>

          <aside className={styles.infoColumn} aria-label="Legend and notes">
            <div className={styles.legend} aria-hidden>
              <span className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: COLORS.eliminated }} />
                Eliminated
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: COLORS.reduced }} />
                Reduced
              </span>
              <span className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: COLORS.unchanged }} />
                Unchanged
              </span>
            </div>

            {pattern.showCaution && pattern.message ? (
              <div className={styles.honesty} role="status">
                <strong>Data check:</strong> {pattern.message}
              </div>
            ) : null}

            <p className={styles.source}>
              Scene 08 — Ridership vs. equity proxy. Built from <code>data/routes_with_demographics.csv</code> (see{" "}
              <code>scripts/build_routes_with_demographics.py</code>
              ): merges FY26 weekday ridership with a worker non-auto commute share for the published anchor geography.
              For tract-buffer zero-vehicle rates, replace the y-axis source and rebuild.
            </p>
          </aside>
        </div>
      ) : null}

      {tip ? (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(typeof window !== "undefined" ? window.innerWidth - 280 : tip.x + 14, tip.x + 14),
            top: tip.y + 14,
          }}
          role="tooltip"
        >
          <div className={styles.tooltipTitle}>{tip.row.route_name}</div>
          <div>Daily riders (weekday avg, recent): {tip.row.avg_daily_riders.toLocaleString()}</div>
          <div>Y-axis value: {tip.row.pct_corridor_no_car.toFixed(1)}%</div>
          <div>Cut status: {cutLabel(tip.row.cut_type)}</div>
          <div className={styles.tooltipMuted}>Neighborhoods (anchor): {tip.row.neighborhoods_served || "—"}</div>
        </div>
      ) : null}
    </div>
  );
}
