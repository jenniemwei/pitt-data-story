"use client";

import styles from "./PovertyPictogram.module.css";

const DOTS = 50;
const COLS = 10;

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Largest-remainder allocation so counts sum to `total`. */
function allocateCounts(total, weights) {
  const w = weights.map(clamp01);
  const s = w.reduce((a, b) => a + b, 0) || 1;
  const norm = w.map((x) => (x / s) * total);
  const floors = norm.map((x) => Math.floor(x));
  let used = floors.reduce((a, b) => a + b, 0);
  let remainder = total - used;
  const frac = norm.map((x, i) => x - floors[i]);
  const order = frac.map((_, i) => i).sort((a, b) => frac[b] - frac[a]);
  const out = [...floors];
  let k = 0;
  while (remainder > 0 && order.length) {
    out[order[k % order.length]] += 1;
    remainder -= 1;
    k += 1;
  }
  return out;
}

/**
 * 50-dot grid: $100k+ households (green), other not in poverty (gray),
 * below poverty line / not deep (orange), deep poverty &lt;50% threshold (red).
 */
export default function PovertyPictogram({
  belowPovertyLineShare = 0,
  deepPovertyShare = 0,
  highIncomeHouseholdShare = 0,
  peoplePerDot = 100,
}) {
  const below = clamp01(belowPovertyLineShare);
  const deep = clamp01(Math.min(deepPovertyShare, below));
  const povertyOnly = Math.max(0, below - deep);
  const high = clamp01(highIncomeHouseholdShare);
  const notPoor = Math.max(0, 1 - below);
  const middle = Math.max(0, notPoor - high);

  const [nGreen, nGray, nOrange, nRed] = allocateCounts(DOTS, [high, middle, povertyOnly, deep]);

  const dots = [];
  let i = 0;
  for (let k = 0; k < nGreen; k += 1) {
    dots.push({ i: i + 1, tone: "high" });
    i += 1;
  }
  for (let k = 0; k < nGray; k += 1) {
    dots.push({ i: i + 1, tone: "mid" });
    i += 1;
  }
  for (let k = 0; k < nOrange; k += 1) {
    dots.push({ i: i + 1, tone: "poverty" });
    i += 1;
  }
  for (let k = 0; k < nRed; k += 1) {
    dots.push({ i: i + 1, tone: "deep" });
    i += 1;
  }
  while (dots.length < DOTS) {
    dots.push({ i: dots.length + 1, tone: "mid" });
  }

  const pct = Math.round(below * 100);

  return (
    <div className={styles.wrap}>
      <p className={styles.title}>
        <span className={styles.titleEm}>{pct}%</span> are below the poverty line
      </p>
      <p className={styles.legendNote}>
        <span className={styles.legendDot} aria-hidden />
        <span>= {peoplePerDot} people</span>
      </p>
      <div
        className={styles.grid}
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        role="img"
        aria-label={`Pictogram of about ${DOTS} times ${peoplePerDot} people by income and poverty status`}
      >
        {dots.map((d) => (
          <span key={d.i} className={styles.cell} data-tone={d.tone} />
        ))}
      </div>
      <div className={styles.axisRow}>
        <span className={styles.axisHigh}>$100k+</span>
        <span className={styles.axisPov}>poverty</span>
        <span className={styles.axisDeep}>deep poverty</span>
      </div>
    </div>
  );
}
