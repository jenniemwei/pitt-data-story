"use client";

import { useId } from "react";
import { fullStoryNarrative as defaultCopy } from "../../../data/narrative";
import styles from "./StoryFullExperience.module.css";

/**
 * @param {{ copy?: typeof defaultCopy }} props
 */
export function StoryOpening({ copy = defaultCopy }) {
  const { opening } = copy;
  const halfClipId = useId().replace(/:/g, "");
  return (
    <section className={styles.storyOpening} aria-labelledby="story-opening-heading">
      <h2 id="story-opening-heading" className="sr-only">
        Weekday travel at regional scale
      </h2>
      <p className={`${styles.storyLead} type-story-line type-story-line-wide text-ink-default`}>{opening.lead}</p>

      <figure className={styles.storyFigure} aria-label={opening.figureTotalAria}>
        <svg className={styles.storySvg} viewBox="0 0 360 270" role="img">
          <title>{opening.figureTotalAria}</title>
          <circle cx="180" cy="100" r="90" className={styles.storyCircleOutline} />
          <line x1="180" y1="190" x2="180" y2="204" className={styles.storyFigureLeader} aria-hidden />
          <text x="180" y="226" textAnchor="middle" className={styles.storyFigureNumber}>
            {opening.totalFigure}
          </text>
          <text x="180" y="248" textAnchor="middle" className={styles.storyFigureCaption}>
            {opening.totalCaption}
          </text>
        </svg>
      </figure>

      <p className={`${styles.storyProse} type-story-line type-story-line-wide text-ink-default`}>{opening.lifeline}</p>
      <p className={`${styles.storyEmphasis} type-story-line type-story-line-wide text-ink-default`}>{opening.placeLine}</p>

      <figure className={styles.storyFigure} aria-label={opening.figurePrtAria}>
        <svg className={styles.storySvg} viewBox="0 0 360 270" role="img">
          <title>{opening.figurePrtAria}</title>
          <defs>
            <clipPath id={halfClipId}>
              <rect x="0" y="100" width="360" height="100" />
            </clipPath>
          </defs>
          <circle cx="180" cy="100" r="90" className={styles.storyCircleOutline} />
          <circle cx="180" cy="100" r="90" className={styles.storyCirclePrtFill} clipPath={`url(#${halfClipId})`} />
          <line x1="180" y1="190" x2="180" y2="204" className={styles.storyFigureLeader} aria-hidden />
          <text x="180" y="226" textAnchor="middle" className={styles.storyFigureNumberHalf}>
            {opening.prtFigure}
          </text>
          <text x="180" y="248" textAnchor="middle" className={styles.storyFigureCaption}>
            {opening.prtCaption}
          </text>
        </svg>
      </figure>

      {opening.prtClosing?.trim() ? (
        <p className={`${styles.storyProse} type-story-line type-story-line-wide text-ink-default`}>{opening.prtClosing}</p>
      ) : null}
    </section>
  );
}

/**
 * @param {{ copy?: typeof defaultCopy }} props
 */
export function FY26PlanStats({ copy = defaultCopy }) {
  const { fy26 } = copy;
  const titleVis = fy26.title?.trim();
  return (
    <section className={styles.fy26Block} aria-labelledby="fy26-heading">
      {titleVis ? (
        <>
          <span className={`${styles.chapterKicker} type-story-kicker text-ink-label`}>{fy26.kicker}</span>
          <h2 id="fy26-heading" className={`${styles.fy26Title} type-story-heading text-ink-default`}>
            {fy26.title}
          </h2>
        </>
      ) : (
        <h2 id="fy26-heading" className={`${styles.chapterKicker} type-story-kicker text-ink-label`}>
          {fy26.kicker}
        </h2>
      )}
      <p className={`${styles.storyProse} type-story-line type-story-line-wide text-ink-default`}>{fy26.body}</p>
      <ul className={styles.fy26Stats} role="list">
        {fy26.stats.map((s) => (
          <li key={s.label} className={styles.fy26Stat}>
            <span className={styles.fy26StatValue} aria-hidden>
              {s.value}
            </span>
            <span className={styles.fy26StatLabel}>{s.label}</span>
          </li>
        ))}
      </ul>
      <p className={`${styles.fy26Footnote} type-story-footnote text-ink-disclaimer`}>{fy26.footnote}</p>
    </section>
  );
}

/**
 * @param {{ copy?: typeof defaultCopy }} props
 */
export function StoryPullQuote({ copy = defaultCopy }) {
  const { pullQuote } = copy;
  return (
    <blockquote className={styles.storyPullQuote}>
      <p className="type-story-narrative text-left text-ink-default">{pullQuote.text}</p>
    </blockquote>
  );
}
