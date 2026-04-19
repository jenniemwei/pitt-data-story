"use client";

import Link from "next/link";
import { GalleryRow } from "../../layout/GalleryRow";
import { fullStoryNarrative } from "../../../data/narrative";
import { storyExperienceStructure } from "../../../data/structure";
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
  { id: "demographics-section", label: "Demographics", href: "/demographics-section" },
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
        {CHAPTERS.map((c) =>
          c.href.startsWith("/") ? (
            <Link key={c.id} href={c.href}>
              {c.label}
            </Link>
          ) : (
            <a key={c.id} href={c.href}>
              {c.label}
            </a>
          ),
        )}
      </nav>

      <section id="story-opening" className={styles.chapter} aria-label="Regional scale of weekday travel">
        <GalleryRow
          variant={storyExperienceStructure.storyOpening.variant}
          measure={storyExperienceStructure.storyOpening.measure}
          layoutId={storyExperienceStructure.storyOpening.id}
          className={styles.narrativeGalleryRow}
        >
          <StoryOpening copy={story} />
        </GalleryRow>
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="persona-before" className={styles.chapter} aria-labelledby="persona-day-heading-before">
        <PersonaDayCard phase="before" showSectionHeading />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="fy26-plan" className={styles.chapter} aria-label="FY26 service proposal at a glance">
        <GalleryRow
          variant={storyExperienceStructure.fy26Plan.variant}
          measure={storyExperienceStructure.fy26Plan.measure}
          layoutId={storyExperienceStructure.fy26Plan.id}
          className={styles.narrativeGalleryRow}
        >
          <FY26PlanStats copy={story} />
        </GalleryRow>
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="corridor-map" className={styles.chapter} aria-label="71B and P10 corridor map">
        <CorridorScrollMap copy={story.corridorMap} />
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="pull-quote" className={styles.chapter} aria-label="Limits of ridership data">
        <GalleryRow
          variant={storyExperienceStructure.pullQuote.variant}
          measure={storyExperienceStructure.pullQuote.measure}
          layoutId={storyExperienceStructure.pullQuote.id}
          className={styles.narrativeGalleryRow}
        >
          <StoryPullQuote copy={story} />
        </GalleryRow>
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
        <GalleryRow
          variant={storyExperienceStructure.tripPurposeChapter.variant}
          measure={storyExperienceStructure.tripPurposeChapter.measure}
          layoutId={storyExperienceStructure.tripPurposeChapter.id}
          className={styles.visualGalleryRow}
        >
          <TripPurposeProxy
            instanceId="trip-purpose-full-story"
            title={story.tripPurpose.title}
            dek={story.tripPurpose.dek}
            routes={story.tripPurpose.routes}
          />
        </GalleryRow>
      </section>

      <hr className={styles.chapterDivider} aria-hidden />

      <section id="equity-dot-map" className={styles.chapter} aria-label="Poverty and transit dependence dot map">
        <GalleryRow
          variant={storyExperienceStructure.equityDotMap.variant}
          measure={storyExperienceStructure.equityDotMap.measure}
          layoutId={storyExperienceStructure.equityDotMap.id}
          className={styles.visualGalleryRow}
        >
          <EquityMap3
            title={story.equityDotMap.title}
            dek={story.equityDotMap.dek}
            showAllRoutesLabel={story.equityDotMap.showAllRoutesLabel}
          />
        </GalleryRow>
      </section>
    </div>
  );
}
