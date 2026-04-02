"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import styles from "./CarOwnershipChart.module.css";

const CHOICE = "choice";
const DEPENDENT = "dependent";

const COLOR_CLASS = {
  [CHOICE]: styles.barChoice,
  [DEPENDENT]: styles.barDependent,
};

/** @typedef {{ name: string; medianIncome: number; pctNoCar: number; group: 'choice' | 'dependent'; routesEliminated: number; routesReduced: number }} NeighborhoodRow */

function safeInt(v, fallback = 0) {
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {Record<string, string>} row
 * @returns {NeighborhoodRow | null}
 */
function rowFromDemographicsCsv(row) {
  const name = (row.neighborhood || "").trim();
  const g = (row.group || "").trim().toLowerCase();
  if (!name || (g !== CHOICE && g !== DEPENDENT)) return null;
  return {
    name,
    medianIncome: safeInt(row.median_household_income, 0),
    pctNoCar: safeFloat(row.pct_no_car, 0),
    group: g,
    routesEliminated: safeInt(row.routes_eliminated, 0),
    routesReduced: safeInt(row.routes_reduced, 0),
  };
}

/**
 * @param {NeighborhoodRow[]} rows
 */
function partitionSorted(rows) {
  const dependent = rows
    .filter((r) => r.group === DEPENDENT)
    .sort((a, b) => b.pctNoCar - a.pctNoCar);
  const choice = rows
    .filter((r) => r.group === CHOICE)
    .sort((a, b) => a.pctNoCar - b.pctNoCar);
  return { dependent, choice };
}

function formatMoney(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

const DEFAULT_DATA_PATH = "/api/data?name=demographics.csv";

/**
 * @param {object} props
 * @param {boolean} [props.animated=true]
 * @param {NeighborhoodRow[] | null} [props.neighborhoods]
 * @param {string} [props.dataUrl]
 * @param {string} [props.title]
 * @param {string} [props.sourceNote]
 */
export function CarOwnershipChart({
  animated = true,
  neighborhoods: neighborhoodsProp = null,
  dataUrl = DEFAULT_DATA_PATH,
  title = "Households without a vehicle",
  sourceNote = null,
}) {
  const rootRef = useRef(null);
  const [loaded, setLoaded] = useState(/** @type {NeighborhoodRow[] | null} */ (neighborhoodsProp));
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null));
  const [entered, setEntered] = useState(!animated);
  const [tip, setTip] = useState(
    /** @type {{ x: number; y: number; row: NeighborhoodRow } | null} */ (null),
  );

  useEffect(() => {
    if (neighborhoodsProp) {
      setLoaded(neighborhoodsProp);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    fetch(dataUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load chart data (${res.status})`);
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
        const rows = [];
        for (const row of data) {
          const parsed = rowFromDemographicsCsv(row);
          if (parsed) rows.push(parsed);
        }
        setLoaded(rows.length ? rows : null);
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Could not load data");
      });
    return () => {
      cancelled = true;
    };
  }, [dataUrl, neighborhoodsProp]);

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
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [animated]);

  const { dependent, choice } = useMemo(
    () => (loaded ? partitionSorted(loaded) : { dependent: [], choice: [] }),
    [loaded],
  );

  const maxPct = useMemo(() => {
    const all = [...dependent, ...choice];
    if (!all.length) return 1;
    return Math.max(1, ...all.map((r) => r.pctNoCar));
  }, [dependent, choice]);

  const onBarMove = useCallback((e, row) => {
    setTip({ x: e.clientX, y: e.clientY, row });
  }, []);

  const onBarLeave = useCallback(() => setTip(null), []);

  const defaultSource =
    "ACS 5-year estimates, 2018–2022 (2022 release; income from city neighborhood profile bins). " +
    "Vehicle share is provisional; swap in confirmed neighborhood ACS when you have it. " +
    "Route counts reflect FY26 proposed elimination vs. reduction in this project’s neighborhood–route join.";

  /**
   * @param {NeighborhoodRow} row
   * @param {number} staggerIndex
   */
  function barRow(row, staggerIndex) {
    const scale = entered ? row.pctNoCar / maxPct : 0;
    const delayMs = animated ? staggerIndex * 50 : 0;
    return (
      <div key={row.name} className={styles.row}>
        <div className={styles.labelBlock}>
          <span className={styles.primaryLabel}>
            {row.name} — {Math.round(row.pctNoCar)}% own no car
          </span>
          <span className={styles.incomeMuted}>
            Median household income {formatMoney(row.medianIncome)}
          </span>
        </div>
        <div className={styles.track}>
          <div
            className={`${styles.bar} ${COLOR_CLASS[row.group]}`}
            style={{
              "--bar-scale": String(scale),
              "--bar-delay": `${delayMs}ms`,
            }}
            aria-hidden
          />
          <button
            type="button"
            className={styles.hit}
            aria-label={`${row.name}: ${Math.round(row.pctNoCar)} percent of households own no vehicle. Median income ${formatMoney(row.medianIncome)}. ${row.routesEliminated} routes eliminated, ${row.routesReduced} routes reduced.`}
            onMouseMove={(e) => onBarMove(e, row)}
            onMouseLeave={onBarLeave}
            onFocus={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              onBarMove({ clientX: r.right + 8, clientY: r.top }, row);
            }}
            onBlur={onBarLeave}
          />
        </div>
      </div>
    );
  }

  const hasRows = dependent.length + choice.length > 0;

  return (
    <div ref={rootRef} className={styles.wrap}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}

      {loadError ? (
        <p className={styles.loading} role="alert">
          {loadError}
        </p>
      ) : null}

      {!loadError && !loaded ? <p className={styles.loading}>Loading…</p> : null}

      {loaded && !hasRows ? <p className={styles.loading}>No rows to display.</p> : null}

      {hasRows ? (
        <>
          <div className={styles.rows}>
            {dependent.map((row, i) => barRow(row, i))}
          </div>

          <div className={styles.groupDivider}>
            <span className={`${styles.dividerLabel} ${styles.dividerLabelDependent}`}>
              Transit as necessity
            </span>
            <div className={styles.dividerLine} aria-hidden />
            <span className={`${styles.dividerLabel} ${styles.dividerLabelChoice}`}>
              Transit as preference
            </span>
          </div>

          <div className={styles.rows}>
            {choice.map((row, i) => barRow(row, dependent.length + i))}
          </div>
        </>
      ) : null}

      <p className={styles.source}>{sourceNote ?? defaultSource}</p>

      {tip ? (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(
              typeof window !== "undefined" ? window.innerWidth - 272 : tip.x + 12,
              tip.x + 12,
            ),
            top: tip.y + 12,
          }}
          role="tooltip"
        >
          <div className={styles.tooltipTitle}>{tip.row.name}</div>
          <div>{Math.round(tip.row.pctNoCar)}% of households own no vehicle</div>
          <div className={styles.tooltipMuted}>
            Median household income: {formatMoney(tip.row.medianIncome)}
          </div>
          <div className={styles.tooltipMuted}>
            FY26 route impacts (this join): {tip.row.routesEliminated} eliminated,{" "}
            {tip.row.routesReduced} reduced
          </div>
        </div>
      ) : null}
    </div>
  );
}
