"use client";

import { useEffect, useState } from "react";
import {
  getRidershipTotalsByPovertyTier,
} from "../../lib/routeData";
import styles from "./CovidVis.module.css";

const TIER_ORDER = /** @type {const} */ (["high", "low"]);

const TIER_LABELS = {
  high: "20% or more poverty",
  low: "Less than 20% poverty",
};

/** Vertical bars: fixed width (columns), height grows with dot count. */
const BAR_DOT_COLS = 8;
const PHASE_PRE = "pre";
const PHASE_POST = "post";

function formatRiders(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

/**
 * @param {{
 *   baselineDots: number;
 *   filledDots: number;
 *   label: string;
 *   caption: string;
 *   phase: "pre" | "post";
 * }} props
 */
function DotStack({ baselineDots, filledDots, label, caption, phase }) {
  const before = Math.max(0, baselineDots);
  const after = Math.max(0, Math.min(filledDots, baselineDots));
  if (before === 0) {
    return (
      <div className={styles.cell}>
        <span className={styles.tierLabel}>{label}</span>
        <div className={styles.emptyBar} role="img" aria-label="No baseline riders in this tier">
          —
        </div>
        <div className={styles.tierMeta}>
          <span className={styles.recoveryNote}>{caption}</span>
        </div>
      </div>
    );
  }
  const slotCount = Math.max(before, 1);
  const rows = Math.max(1, Math.ceil(slotCount / BAR_DOT_COLS));
  const slots = Array.from({ length: slotCount }, (_, i) => i);
  const isPrePhase = phase === PHASE_PRE;
  const filledCount = isPrePhase ? before : after;

  return (
    <div className={styles.cell}>
      <span className={styles.tierLabel}>{label}</span>
      <div
        className={styles.dotStack}
        style={{
          gridTemplateRows: `repeat(${rows}, var(--dot-size))`,
          gridTemplateColumns: `repeat(${BAR_DOT_COLS}, var(--dot-size))`,
        }}
        role="img"
        aria-label={
          isPrePhase
            ? `2018 pre-COVID baseline ${before} dots`
            : `2024 post-COVID ${after} dots of ${before} baseline`
        }
      >
        {slots.map((i) => {
          const fromBottom = slotCount - i;
          const isFilled = fromBottom <= filledCount;
          return (
            <span key={i} className={styles.slot}>
              <span className={styles.dotGhost} aria-hidden />
              <span
                className={`${styles.dotSolidOverlay} ${isFilled ? styles.dotFilled : ""}`}
                style={{ transitionDelay: `${Math.min(fromBottom * 12, 400)}ms` }}
                aria-hidden
              />
            </span>
          );
        })}
      </div>
      <div className={styles.tierMeta}>
        <span key={phase} className={styles.recoveryNote}>
          {caption}
        </span>
      </div>
    </div>
  );
}

export default function CovidRecoveryDotsComparison() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [phase, setPhase] = useState(PHASE_PRE);

  useEffect(() => {
    let cancelled = false;
    getRidershipTotalsByPovertyTier()
      .then((d) => {
        if (!cancelled) {
          setData(d);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message || e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setPhase((prev) => (prev === PHASE_PRE ? PHASE_POST : PHASE_PRE));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const scale = data?.scale;

  return (
    <section className={styles.wrap} aria-labelledby="covid-recovery-dots-heading">
      <h2 id="covid-recovery-dots-heading" className={styles.title}>
        COVID ridership recovery by route poverty tier
      </h2>

      {err ? <p className={styles.err}>{err}</p> : null}
      {!data && !err ? <p className={styles.loading}>Loading…</p> : null}

      {data && scale ? (
        <>
          <div className={styles.grid}>
            {TIER_ORDER.map((tier) => {
              const d = data[tier];
              const pct =
                d.recoveryPct != null && Number.isFinite(d.recoveryPct)
                  ? `${d.recoveryPct >= 0 ? "+" : ""}${d.recoveryPct.toFixed(1)}%`
                  : "—";
              const caption =
                phase === PHASE_PRE
                  ? "2018 (pre-COVID) baseline"
                  : `2024 (post-COVID): ${formatRiders(d.recentSum)} riders (${pct} vs 2018)`;
              return (
                <DotStack
                  key={`viz-${tier}`}
                  baselineDots={d.beforeDots}
                  filledDots={d.afterDots}
                  label={TIER_LABELS[tier]}
                  caption={caption}
                  phase={phase}
                />
              );
            })}
          </div>
        </>
      ) : null}
    </section>
  );
}
