"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./BusRouteComparison.module.css";

const ROW_HEIGHT = 44;
const STOP_BLOCK_WIDTH = 28;
const DOT_DIAMETER = 12;
const DOT_RADIUS = DOT_DIAMETER / 2;
const MIN_SPACING = 18;
const MAX_SPACING = 120;
const DOT_SPEED_PX_PER_SEC = 44;
const ROUTE_LINE_OPACITY = 0.4;
const ELIMINATED_LINE_OPACITY = 0.2;

function spacingFromHeadway(headwayMinutes) {
  if (!Number.isFinite(headwayMinutes) || headwayMinutes <= 0) return MAX_SPACING;
  // Fixed speed + variable spacing means frequency is encoded by rhythm.
  return Math.max(MIN_SPACING, Math.min(MAX_SPACING, headwayMinutes * 2.7));
}

// Phantom pool: pre-allocate enough circles to fill the canvas at any offset.
// +1 covers a partially visible dot at the right edge.
function phantomDotCount(canvasWidth, headwayPx) {
  return Math.ceil(canvasWidth / headwayPx) + 1;
}

function RouteRow({
  rowKey,
  rowLabel,
  routes,
  width,
  registerRow,
  unregisterRow,
  showLabels,
}) {
  const lineRefs = useRef(new Map());
  const dotsGroupRef = useRef(null);

  useEffect(() => {
    if (!dotsGroupRef.current) return undefined;
    if (lineRefs.current.size !== routes.length) return undefined;

    registerRow({
      rowKey,
      lineElsByRouteId: lineRefs.current,
      dotsGroupEl: dotsGroupRef.current,
      width,
      routes,
      rowLabel,
    });

    return () => unregisterRow(rowKey);
  }, [rowKey, width, routes, registerRow, unregisterRow, rowLabel]);

  const setLineRef = (routeId) => (el) => {
    if (!el) {
      lineRefs.current.delete(routeId);
      return;
    }
    lineRefs.current.set(routeId, el);
  };

  return (
    <div className={styles.row}>
      {showLabels ? (
        <span className={`${styles.label} type-body-m text-ink-default`} aria-hidden>
          {rowLabel}
        </span>
      ) : null}
      <svg className={styles.svg} width={width} height={ROW_HEIGHT} viewBox={`0 0 ${width} ${ROW_HEIGHT}`} aria-hidden>
        <rect x={width - STOP_BLOCK_WIDTH} y={0} width={STOP_BLOCK_WIDTH} height={ROW_HEIGHT} fill="var(--b9)" />
        {routes.map((route) => (
          <line
            key={`${rowKey}-${route.id}-line`}
            ref={setLineRef(route.id)}
            x1={0}
            y1={ROW_HEIGHT / 2}
            x2={width - STOP_BLOCK_WIDTH}
            y2={ROW_HEIGHT / 2}
            stroke={route.color}
            strokeWidth="1.5"
            opacity={ROUTE_LINE_OPACITY}
          />
        ))}
        <g ref={dotsGroupRef} />
      </svg>
    </div>
  );
}

export default function BusRouteComparison({ stop, routes, selectedArea, width, showLabels = true }) {
  const containerRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(width || 0);
  const rowsRef = useRef(new Map());
  const rafRef = useRef(null);
  const prevTsRef = useRef(null);

  const resolvedWidth = width || measuredWidth;

  useEffect(() => {
    if (width) return undefined;
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width || 0;
      setMeasuredWidth(Math.max(0, Math.floor(next)));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);

  const registerRow = useMemo(
    () => (row) => {
      row.dotsGroupEl.innerHTML = "";
      const perRoute = row.routes.map((route) => {
        const headwayPx = spacingFromHeadway(row.rowLabel === "before" ? route.headwayBefore : route.headwayAfter);
        const hasDots = row.rowLabel === "before" || route.status !== "eliminated";
        // Eliminated routes pass an empty array — no circles created.
        const dotCount = hasDots ? phantomDotCount(row.width, headwayPx) : 0;
        const circles = [];

        for (let i = 0; i < dotCount; i += 1) {
          const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          c.setAttribute("r", String(DOT_RADIUS));
          c.setAttribute("cy", String(ROW_HEIGHT / 2));
          c.setAttribute("fill", route.color);
          c.setAttribute("visibility", "hidden");
          row.dotsGroupEl.appendChild(c);
          circles.push(c);
        }

        // offset is mutable — the RAF loop advances it in-place each frame.
        // Resetting to 0 here ensures no position jump when headway changes.
        return { route, headwayPx, hasDots, offset: 0, circles };
      });

      rowsRef.current.set(row.rowKey, { ...row, perRoute });
    },
    [],
  );

  const unregisterRow = useMemo(
    () => (rowKey) => {
      rowsRef.current.delete(rowKey);
    },
    [],
  );

  useEffect(() => {
    if (!resolvedWidth || rowsRef.current.size === 0) return undefined;

    const tick = (ts) => {
      // Delta-time advance: 0 on the first frame after a restart so no jump.
      const deltaSec = prevTsRef.current == null ? 0 : (ts - prevTsRef.current) / 1000;
      prevTsRef.current = ts;

      for (const row of rowsRef.current.values()) {
        // Stop block is on the right; dots travel left → stop.
        const minX = DOT_RADIUS;
        const maxX = row.width - STOP_BLOCK_WIDTH - DOT_RADIUS;

        for (const routeData of row.perRoute) {
          const { route, hasDots, circles, headwayPx } = routeData;

          const lineEl = row.lineElsByRouteId.get(route.id);
          if (lineEl) {
            const opacity =
              row.rowLabel === "after" && route.status === "eliminated"
                ? ELIMINATED_LINE_OPACITY
                : ROUTE_LINE_OPACITY;
            lineEl.setAttribute("opacity", String(opacity));
          }

          if (!hasDots) continue;

          // Advance shared offset for this route; keep in [0, headwayPx).
          routeData.offset = (routeData.offset + deltaSec * DOT_SPEED_PX_PER_SEC) % headwayPx;

          // Phantom pool: dots enter from the right (maxX) and travel left toward
          // the stop block. cx = maxX - offset - n*headway mirrors the L-to-R formula.
          for (let n = 0; n < circles.length; n += 1) {
            const cx = maxX - routeData.offset - n * headwayPx;
            if (cx >= minX && cx <= maxX) {
              circles[n].setAttribute("cx", String(cx));
              circles[n].setAttribute("visibility", "visible");
            } else {
              circles[n].setAttribute("visibility", "hidden");
            }
          }
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      prevTsRef.current = null; // reset delta so next loop's first frame advances by 0
    };
  }, [resolvedWidth, routes]);

  if (!stop || !Array.isArray(routes) || routes.length === 0) return null;

  const majorRoutes = routes.filter((route) => route.status === "reduced" && Number.isFinite(route.headwayAfter));
  const eliminatedRoutes = routes.filter((route) => route.status === "eliminated");

  return (
    <section ref={containerRef} className={styles.wrap} aria-label={`Route service comparison for stop ${stop.name}`}>
      <div className={styles.topline}>
        <p className={`${styles.stopName} type-body-m text-ink-default`}>Stop Name: {stop.name}</p>
        <p className={`${styles.areaText} type-data-label text-ink-subtle`}>
          {selectedArea ? `${selectedArea}` : ""}
        </p>
      </div>

      <RouteRow
        rowKey="before-row"
        rowLabel="before"
        routes={routes}
        width={resolvedWidth}
        registerRow={registerRow}
        unregisterRow={unregisterRow}
        showLabels={showLabels}
      />

      <div className={styles.chips}>
        {routes.map((route) => (
          <span key={`${route.id}-chip`} className={`${styles.chip} type-data-route-label`} style={{ background: route.color }}>
            {route.label}
          </span>
        ))}
      </div>

      <RouteRow
        rowKey="after-row"
        rowLabel="after"
        routes={routes}
        width={resolvedWidth}
        registerRow={registerRow}
        unregisterRow={unregisterRow}
        showLabels={showLabels}
      />

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className="type-data-label text-ink-secondary">Major Reduction</span>
          <div className={styles.chips}>
            {majorRoutes.map((route) => (
              <span key={`${route.id}-major`} className={`${styles.chip} type-data-route-label`} style={{ background: route.color }}>
                {route.label}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.legendItem}>
          <span className="type-data-label text-ink-secondary">Eliminated</span>
          <div className={styles.chips}>
            {eliminatedRoutes.map((route) => (
              <span
                key={`${route.id}-eliminated`}
                className={`${styles.chip} ${styles.chipEliminated} type-data-route-label`}
                style={{ background: route.color }}
              >
                {route.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
