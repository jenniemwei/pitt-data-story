"use client";

import styles from "./CommuteMethodGauge.module.css";

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Upper semicircle gauge: work from home (green), vehicle/walk/other (neutral), public transit (red).
 * Shares should be proportions of workers 16+ with known commute (ACS-style).
 */
export default function CommuteMethodGauge({
  workFromHomeShare = 0,
  vehicleWalkShare = 0,
  transitShare = 0,
  transitPctLabel,
}) {
  const wfh = clamp01(workFromHomeShare);
  const transit = clamp01(transitShare);
  const vehicle = clamp01(vehicleWalkShare);
  const sum = wfh + vehicle + transit || 1;
  const a = wfh / sum;
  const b = vehicle / sum;
  const c = transit / sum;

  const pctTransit = transitPctLabel ?? Math.round(c * 100);

  const cx = 100;
  const cy = 100;
  const r = 78;

  function polar(angle) {
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  const start = Math.PI;
  let angle = start;
  const segments = [
    { share: a, color: "var(--color-special-positive, #047857)" },
    { share: b, color: "var(--n2, #d1cdc8)" },
    { share: c, color: "var(--r2, #d85c4d)" },
  ];

  const paths = [];
  let segIdx = 0;
  for (const seg of segments) {
    if (seg.share <= 0) continue;
    const da = Math.PI * seg.share;
    const [sx, sy] = polar(angle);
    const [ex, ey] = polar(angle + da);
    const largeArc = da > Math.PI ? 1 : 0;
    paths.push(
      <path
        key={`seg-${segIdx}`}
        d={`M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`}
        fill={seg.color}
      />,
    );
    angle += da;
    segIdx += 1;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.title}>
        <span className={styles.titleEm}>{pctTransit}%</span> commute with PRT
      </p>
      <div className={styles.chart} aria-hidden>
        <svg className={styles.svg} viewBox="0 0 200 108" preserveAspectRatio="xMidYMax meet">
          {paths}
        </svg>
      </div>
      <ul className={styles.legend}>
        <li>
          <span className={styles.swatch} data-variant="wfh" /> work from home
        </li>
        <li>
          <span className={styles.swatch} data-variant="vehicle" /> vehicle / walk
        </li>
        <li>
          <span className={styles.swatch} data-variant="transit" /> transit
        </li>
      </ul>
    </div>
  );
}
