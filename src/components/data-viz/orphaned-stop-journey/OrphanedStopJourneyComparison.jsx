"use client";

import styles from "./OrphanedStopJourneyComparison.module.css";

const JOURNEYS = [
  {
    id: "before",
    title: "Before cut (Route 26)",
    subtitle: "Home in Crafton Heights to Downtown shift",
    totalMin: 44,
    segments: [
      {
        mode: "walk",
        minutes: 6,
        text: "Walk from home to W03300 (CHARTIERS AVE OPP CORLISS ST).",
      },
      {
        mode: "bus",
        route: "26",
        minutes: 30,
        board: "W03300 (CHARTIERS AVE OPP CORLISS ST)",
        alight: "Downtown stop near Liberty corridor",
      },
      {
        mode: "walk",
        minutes: 8,
        text: "Walk from Downtown stop to workplace.",
      },
    ],
  },
  {
    id: "after",
    title: "After cut (alternative)",
    subtitle: "Nearest replacement path after Route 26 elimination",
    totalMin: 72,
    segments: [
      {
        mode: "walk",
        minutes: 14,
        text: "Longer walk to W70158 (W CARSON ST AT CORLISS TUNNEL NS), ~0.36 miles from orphaned stop W03300.",
      },
      {
        mode: "bus",
        route: "21",
        minutes: 50,
        board: "W70158 (W CARSON ST AT CORLISS TUNNEL NS)",
        alight: "Downtown stop via West Carson corridor",
      },
      {
        mode: "walk",
        minutes: 8,
        text: "Walk from Downtown stop to workplace.",
      },
    ],
  },
];

export default function OrphanedStopJourneyComparison() {
  return (
    <section className={styles.wrap} aria-label="Before and after journey comparison">
      <header className={styles.header}>
        <h1>Crafton Heights rider: before vs after Route 26 cut</h1>
        <p>Scroll down. Taller timeline means more time.</p>
      </header>

      <div className={styles.stack}>
        {JOURNEYS.map((journey) => (
          <article key={journey.id} className={styles.card}>
            <h2>{journey.title}</h2>
            <p className={styles.sub}>{journey.subtitle}</p>
            <p className={styles.total}>Total: ~{journey.totalMin} min</p>

            <div className={styles.timeline} role="list" aria-label={`${journey.title} timeline`}>
              {journey.segments.map((seg, idx) => (
                <div
                  key={`${journey.id}-${idx}`}
                  className={`${styles.segment} ${seg.mode === "walk" ? styles.walk : styles.bus}`}
                  style={{ height: `${seg.minutes * 9}px` }}
                  role="listitem"
                >
                  <div className={styles.segmentHead}>
                    <span>{seg.mode === "walk" ? "Walk" : `Bus ${seg.route}`}</span>
                    <span>{seg.minutes} min</span>
                  </div>

                  {seg.mode === "bus" ? (
                    <p className={styles.segmentText}>
                      <strong>{seg.route}</strong>: board at {seg.board}, get off at {seg.alight}.
                    </p>
                  ) : (
                    <p className={styles.segmentText}>{seg.text}</p>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

