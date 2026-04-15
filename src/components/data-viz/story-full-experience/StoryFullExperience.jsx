"use client";

import { fullStoryNarrative } from "../../../data/narrative";
import CorridorScrollMap from "../equity-map/CorridorScrollMap";
import EquityMap3 from "../equity-map/EquityMap3";
import { PersonaDayCard } from "../persona-day-card/PersonaDayCard";
import { TripPurposeProxy } from "../trip-purpose-proxy/TripPurposeProxy";
import { FY26PlanStats, StoryOpening, StoryPullQuote } from "./StoryNarrativeBlocks";
import styles from "./StoryFullExperience.module.css";

const CHAPTERS = [
  { id: "story-opening", label: "Morning scale", href: "#story-opening" },
  { id: "persona-before", label: "Two riders", href: "#persona-before" },
  { id: "fy26-plan", label: "FY26 plan", href: "#fy26-plan" },
  { id: "corridor-map", label: "Corridor map", href: "#corridor-map" },
  { id: "pull-quote", label: "Beyond ridership", href: "#pull-quote" },
  { id: "persona-after", label: "After cuts", href: "#persona-after" },
  { id: "trip-purpose", label: "Trip purpose", href: "#trip-purpose" },
  { id: "equity-dot-map", label: "Dot map", href: "#equity-dot-map" },
];

const story = fullStoryNarrative;

/**
 * Full linear story: scale → personas (before) → FY26 stats → corridor Mapbox → pull quote → personas (after) → trip purpose.
 */
export function StoryFullExperience() {
  return (
    <div className={styles.wrap}>
      <nav className={styles.nav} aria-label="Story chapters">
        <span className={styles.navLabel}>Jump to</span>
        {CHAPTERS.map((c) => (
          <a key={c.id} href={c.href}>
            {c.label}
          </a>
        ))}
      </nav>

      <section id="story-opening" className={styles.chapter} aria-label="Regional scale of weekday travel">
        <StoryOpening copy={story} />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="persona-before" className={styles.chapter} aria-labelledby="persona-day-heading-before">
        <PersonaDayCard phase="before" showSectionHeading />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="fy26-plan" className={styles.chapter} aria-label="FY26 service proposal at a glance">
        <FY26PlanStats copy={story} />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="corridor-map" className={styles.chapter} aria-label="71B and P10 corridor map">
        <CorridorScrollMap copy={story.corridorMap} />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="pull-quote" className={styles.chapter} aria-label="Limits of ridership data">
        <StoryPullQuote copy={story} />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="persona-after" className={styles.chapter} aria-labelledby="persona-day-heading-after">
        <PersonaDayCard phase="after" showSectionHeading />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section
        id="trip-purpose"
        className={`${styles.chapter} ${styles.tripPurposeShelf}`}
        aria-label="Trip purpose proxy"
      >
        <TripPurposeProxy
          instanceId="trip-purpose-full-story"
          title={story.tripPurpose.title}
          dek={story.tripPurpose.dek}
          routes={story.tripPurpose.routes}
        />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="equity-dot-map" className={styles.chapter} aria-label="Poverty and transit dependence dot map">
        <EquityMap3 title={story.equityDotMap.title} dek={story.equityDotMap.dek} />
      </section>
    </div>
  );
}
