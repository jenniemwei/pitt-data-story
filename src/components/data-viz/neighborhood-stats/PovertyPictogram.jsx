"use client";

import styles from "./PovertyPictogram.module.css";

const DOTS = 100;
const COLS = 20;
const ROWS = DOTS / COLS;

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
 * Rightmost `count` cells in column-major order: each column top→bottom, columns right→left.
 * Index is row-major linear index (row * COLS + col).
 */
function rightColumnMajorIndices(cols, rows, count) {
  const out = [];
  for (let c = cols - 1; c >= 0 && out.length < count; c -= 1) {
    for (let r = 0; r < rows && out.length < count; r += 1) {
      out.push(r * cols + c);
    }
  }
  return out;
}

/** Sort linear indices column-major from the left: col 0 top→bottom, then col 1, … */
function leftColumnMajorSort(indices, cols) {
  return [...indices].sort((a, b) => {
    const ca = a % cols;
    const cb = b % cols;
    if (ca !== cb) return ca - cb;
    const ra = Math.floor(a / cols);
    const rb = Math.floor(b / cols);
    return ra - rb;
  });
}

/**
 * 50-dot grid: $100k+ (green) and other not-in-poverty bands use column-major from the left
 * (same fill pattern: columns, then rows). Poverty / deep poverty use column-major from the right.
 * Add future income bands to `leftBands` in paint order (left CM among non-poverty cells).
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

  const povertyBlock = nOrange + nRed;
  const rightOrder = rightColumnMajorIndices(COLS, ROWS, povertyBlock);
  const deepIdx = rightOrder.slice(0, nRed);
  const povertyIdx = rightOrder.slice(nRed, nRed + nOrange);
  const povertySet = new Set([...deepIdx, ...povertyIdx]);

  const remaining = [];
  for (let idx = 0; idx < DOTS; idx += 1) {
    if (!povertySet.has(idx)) remaining.push(idx);
  }

  /** Order for all “left block” income tones (extend when new shares are added). */
  const leftBands = [
    { count: nGreen, tone: "high" },
    { count: nGray, tone: "mid" },
  ];

  const remainingLeftCm = leftColumnMajorSort(remaining, COLS);

  /** @type {("high"|"mid"|"poverty"|"deep"|string)[]} */
  const tones = Array(DOTS).fill("mid");
  let leftOffset = 0;
  for (const band of leftBands) {
    for (let k = 0; k < band.count; k += 1) {
      tones[remainingLeftCm[leftOffset + k]] = band.tone;
    }
    leftOffset += band.count;
  }
  for (const idx of povertyIdx) {
    tones[idx] = "poverty";
  }
  for (const idx of deepIdx) {
    tones[idx] = "deep";
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
        {tones.map((tone, idx) => (
          <span key={idx} className={styles.cell} data-tone={tone} />
        ))}
      </div>
      <div className={styles.axisRow}>
        <span className={styles.axisHigh}>$100k+</span>
        <span className={styles.axisMid}>other incomes</span>
        <span className={styles.axisPov}>poverty</span>
        <span className={styles.axisDeep}>deep poverty</span>
      </div>
    </div>
  );
}
