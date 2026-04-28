"use client";

import { useEffect, useState } from "react";
import {
  getCutRoutesByPovertyTier,
  getRidershipTotalsByPovertyTier,
  RIDERS_PER_DOT,
} from "../../lib/routeData";
import styles from "./CovidVis.module.css";

const TIER_ORDER = /** @type {const} */ (["high", "low"]);

const TIER_LABELS = {
  high: "20% or more poverty",
  low: "Less than 20% poverty",
};

/** Horizontal bars: fixed height (rows), width grows with dot count. */
const BAR_DOT_ROWS = 4;

function formatRiders(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

/**
 * @param {{ ghost: boolean; beforeDots: number; afterDots?: number }} props
 */
function DotStack({ ghost, beforeDots, afterDots = 0 }) {
  const before = Math.max(0, beforeDots);
  const after = Math.max(0, afterDots);
  if (!ghost && before === 0) {
    return (
      <div className={styles.emptyBar} role="img" aria-label="No baseline riders in this tier">
        —
      </div>
    );
  }
  const slotCount = ghost ? Math.max(before, after, 1) : before;
  const cols = Math.max(1, Math.ceil(slotCount / BAR_DOT_ROWS));
  const slots = Array.from({ length: slotCount }, (_, i) => i);
  const showGhost = (i) => ghost && i < before;
  const showSolid = (i) => ghost && i < after;
  const showSolidOnly = (i) => !ghost && i < before;

  return (
    <div
      className={styles.dotStack}
      style={{
        gridTemplateRows: `repeat(${BAR_DOT_ROWS}, var(--dot-size))`,
        gridTemplateColumns: `repeat(${cols}, var(--dot-size))`,
      }}
      role="img"
      aria-label={
        ghost
          ? `Pre-COVID ${before} dots as reference; recent ${after} dots on same scale`
          : `Pre-COVID baseline ${before} dots`
      }
    >
      {slots.map((i) => (
        <span key={i} className={styles.slot}>
          {showGhost(i) ? <span className={styles.dotGhost} aria-hidden /> : null}
          {!ghost && showSolidOnly(i) ? <span className={styles.dotSolid} aria-hidden /> : null}
          {ghost && showSolid(i) ? <span className={styles.dotSolidOverlay} aria-hidden /> : null}
        </span>
      ))}
    </div>
  );
}

export default function CovidRecoveryDotsComparison() {
  const [data, setData] = useState(null);
  const [cuts, setCuts] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getRidershipTotalsByPovertyTier(), getCutRoutesByPovertyTier()])
      .then(([d, c]) => {
        if (!cancelled) {
          setData(d);
          setCuts(c);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message || e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scale = data?.scale;

  return (
    <section className={styles.wrap} aria-labelledby="covid-recovery-dots-heading">
      <h2 id="covid-recovery-dots-heading" className={styles.title}>
        COVID ridership recovery by route poverty tier
      </h2>
      <p className={styles.dek}>
        Each dot is <strong>1,000</strong> summed weekday riders (rounded) from{" "}
        <code className={styles.code}>route_status_official.csv</code>, grouped by route anchor poverty tier. Faded
        dots are the <strong>2017–19 baseline</strong> tier total; solid dots are <strong>2023–24 recent</strong> on
        the same scale. Each tier is a horizontal bar (4 dots tall); bar at left, label at right.
      </p>

      {scale ? (
        <p className={styles.scaleLine}>
          <strong>1 dot = {RIDERS_PER_DOT.toLocaleString()} weekday riders</strong> · largest pre-COVID tier sum ≈{" "}
          {formatRiders(scale.maxBaselineAcrossTiers)} riders.
        </p>
      ) : null}

      {err ? <p className={styles.err}>{err}</p> : null}
      {!data && !err ? <p className={styles.loading}>Loading…</p> : null}

      {data && scale ? (
        <>
          <div className={styles.rowLabel}>Recent vs baseline (same tier, same scale)</div>
          <div className={styles.grid}>
            {TIER_ORDER.map((tier) => {
              const d = data[tier];
              const pct =
                d.recoveryPct != null && Number.isFinite(d.recoveryPct)
                  ? `${d.recoveryPct >= 0 ? "+" : ""}${d.recoveryPct.toFixed(1)}%`
                  : "—";
              return (
                <div key={`viz-${tier}`} className={styles.cell}>
                  <DotStack ghost beforeDots={d.beforeDots} afterDots={d.afterDots} />
                  <div className={styles.tierMeta}>
                    <span className={styles.tierLabel}>{TIER_LABELS[tier]}</span>
                    <span className={styles.recoveryNote}>
                      {d.afterDots} recent / {d.beforeDots} baseline dots · {formatRiders(d.recentSum)} /{" "}
                      {formatRiders(d.baselineSum)} riders · {pct} vs baseline
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* {cuts ? (
            <div className={styles.cutTableWrap}>
              <h3 className={styles.cutTableTitle}>FY26 routes eliminated or reduced, by poverty tier</h3>
              <p className={styles.cutTableDek}>
                Same tier bands as the chart. Source: <code className={styles.code}>route_status</code>,{" "}
                <code className={styles.code}>reduction_tier</code>,{" "}
                <code className={styles.code}>pct_below_poverty_line_residents</code>.
              </p>
              <div className={styles.accordionList}>
                {TIER_ORDER.map((tier) => {
                  const rows = cuts[tier] ?? [];
                  const countLabel = `${rows.length} route${rows.length === 1 ? "" : "s"}`;
                  return (
                    <details key={tier} className={styles.cutAccordion}>
                      <summary className={styles.cutAccordionSummary}>
                        {TIER_LABELS[tier]}
                        <span className={styles.cutAccordionMeta}> ({countLabel})</span>
                      </summary>
                      <div className={styles.tableScroll}>
                        <table className={styles.cutTable}>
                          <thead>
                            <tr>
                              <th scope="col">Route</th>
                              <th scope="col">Schedule / name</th>
                              <th scope="col">FY26 outcome</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.length === 0 ? (
                              <tr>
                                <td colSpan={3} className={styles.cutEmptyCell}>
                                  No eliminated or reduced routes in this tier.
                                </td>
                              </tr>
                            ) : (
                              rows.map((row) => (
                                <tr key={`${tier}-${row.routeId}`}>
                                  <td className={styles.routeCode}>{row.routeId}</td>
                                  <td>{row.scheduleName}</td>
                                  <td>{row.statusLabel}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          ) : null} */}

          <p className={styles.footnote}>
            Dot counts: <code className={styles.code}>round(riders / {RIDERS_PER_DOT})</code> per tier (
            <code className={styles.code}>RIDERS_PER_DOT = {RIDERS_PER_DOT}</code> in{" "}
            <code className={styles.code}>routeData.js</code>). Bars are 4 dots tall; width is{" "}
            <code className={styles.code}>ceil(dots / 4)</code> columns (column-major fill). Ridership totals exclude
            routes without valid baseline and recent counts. Poverty buckets: ≥20% vs &lt;20% (
            <code className={styles.code}>pct_below_poverty_line_residents</code>).
          </p>
        </>
      ) : null}
    </section>
  );
}
