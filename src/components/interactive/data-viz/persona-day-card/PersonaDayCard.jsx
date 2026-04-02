"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { personaDayCardNarrative as defaultNarrative } from "../../../../narrative";
import { DataRationaleIcon } from "../../ui/DataRationaleIcon";
import { JourneyThumb } from "./JourneyThumb";
import styles from "./PersonaDayCard.module.css";

/**
 * @typedef {{ time: string; description: string }} Trip
 * @typedef {{ value: string; label: string }} Stat
 * @typedef {{ type: 'manageable' | 'critical'; items: string[] }} AfterCut
 * @typedef {{ src?: string; side?: 'left' | 'right'; opacity?: number }} JourneyStepImage
 * @typedef {{
 *   edgeKind: 'firstMile' | 'transit' | 'uncertain';
 *   edgeLabel: string;
 *   minutes: number;
 *   nodeLabel: string;
 *   stepPhoto?: JourneyStepImage;
 *   arrivalPhoto?: JourneyStepImage;
 * }} JourneySegment
 * @typedef {{
 *   name: string;
 *   tag: string;
 *   neighborhood: string;
 *   incomeLabel: string;
 *   hasCar: boolean;
 *   carStatusLabel: string;
 *   startNodeLabel?: string;
 *   journeyBefore: JourneySegment[];
 *   journeyAfter: JourneySegment[];
 *   trips: Trip[];
 *   stats: Stat[];
 *   statsAfter?: Stat[];
 *   afterCut: AfterCut;
 * }} Persona
 */

/**
 * @typedef {typeof defaultNarrative.ui} PersonaDayUi
 * @typedef {{ personas: { a: Persona; b: Persona }; ui: PersonaDayUi & Record<string, string> }} PersonaDayNarrative
 */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

/** @param {{ minutes: number }[]} segments */
function sumMinutes(segments) {
  return segments.reduce((a, s) => a + s.minutes, 0);
}

/**
 * Stop visual: grey placeholder rectangle (varied size + stagger), or real photo when `image.src` is set.
 * @param {{ image: JourneyStepImage; frameClass: string; placeholderIndex: number }} props
 */
function JourneyStopVisual({ image, frameClass, placeholderIndex }) {
  const side = image.side ?? "right";
  const useImg = Boolean(image.src?.trim());
  const sizeClass = [styles.phSizeS, styles.phSizeM, styles.phSizeL][placeholderIndex % 3];
  const staggerClass = [styles.phStagger0, styles.phStagger1, styles.phStagger2][placeholderIndex % 3];
  const opacity = useImg ? image.opacity ?? 0.92 : undefined;

  return (
    <figure
      className={`${frameClass} ${sizeClass} ${staggerClass} ${side === "left" ? styles.journeyThumbLeft : styles.journeyThumbRight} ${useImg ? styles.journeyThumbHasImg : ""}`}
      style={opacity != null ? { opacity } : undefined}
      aria-hidden
    >
      {useImg ? (
        <img className={styles.journeyThumbImg} src={image.src} alt="" decoding="async" loading="lazy" />
      ) : (
        <span className={styles.journeyPlaceholderBlock} />
      )}
    </figure>
  );
}

/**
 * @param {object} props
 * @param {PersonaDayNarrative} [props.narrative]
 * @param {boolean} [props.showSectionHeading]
 * @param {'before' | 'after'} [props.phase]
 */
export function PersonaDayCard({ narrative = defaultNarrative, showSectionHeading = false, phase = "before" }) {
  const { personas, ui } = narrative;
  const reducedMotion = usePrefersReducedMotion();
  const pxPerMin = reducedMotion ? 3.5 : 8.25;

  const isAfter = phase === "after";
  const headingId = isAfter ? "persona-day-heading-after" : "persona-day-heading-before";
  const titleRaw = isAfter
    ? ui.sectionHeadingAfter ?? ui.sectionHeading
    : ui.sectionHeadingBefore ?? ui.sectionHeading;
  const title = String(titleRaw ?? "").trim();
  const dek = isAfter ? ui.sectionAfterDek : ui.sectionBeforeDek;
  const dekText = String(dek ?? "").trim();
  const srFallback = isAfter ? "After service changes" : "Persona journeys";
  const hasVisibleHeading = showSectionHeading && (title || dekText);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={hasVisibleHeading ? styles.sectionHeadingVisible : "visually-hidden"}>
        {hasVisibleHeading ? (
          title && dekText ? (
            <>
              {title}
              <br />
              <span className={styles.sectionHeadingSub}>{dek}</span>
            </>
          ) : title ? (
            title
          ) : (
            <span className={styles.sectionHeadingSub}>{dek}</span>
          )
        ) : (
          title || dekText || srFallback
        )}
      </h2>

      <div className={styles.journeyGrid}>
        <JourneyColumn
          persona={personas.a}
          segments={isAfter ? personas.a.journeyAfter : personas.a.journeyBefore}
          compareSegments={isAfter ? personas.a.journeyBefore : null}
          ui={ui}
          variant="a"
          ariaLabel={ui.columnAriaLabelA}
          pxPerMin={pxPerMin}
          showConsequences={isAfter}
          scrollRevealConsequences={false}
          reducedMotion={reducedMotion}
        />
        <JourneyColumn
          persona={personas.b}
          segments={isAfter ? personas.b.journeyAfter : personas.b.journeyBefore}
          compareSegments={isAfter ? personas.b.journeyBefore : null}
          ui={ui}
          variant="b"
          ariaLabel={ui.columnAriaLabelB}
          pxPerMin={pxPerMin}
          showConsequences={isAfter}
          scrollRevealConsequences
          reducedMotion={reducedMotion}
        />
      </div>

      {ui.journeyScaleNote?.trim() || ui.sharedRouteNote?.trim() ? (
        <div className={styles.methodNoteRow} role="group" aria-label="Method notes">
          {ui.journeyScaleNote?.trim() ? (
            <DataRationaleIcon
              label="How journey leg heights are scaled"
              rationale={ui.journeyScaleNote.trim()}
            />
          ) : null}
          {ui.sharedRouteNote?.trim() ? (
            <DataRationaleIcon
              label="How route cuts and consequences are modeled"
              rationale={ui.sharedRouteNote.trim()}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * @param {object} props
 * @param {Persona} props.persona
 * @param {JourneySegment[]} props.segments
 * @param {JourneySegment[] | null} props.compareSegments
 * @param {PersonaDayUi} props.ui
 * @param {'a' | 'b'} props.variant
 * @param {string} props.ariaLabel
 * @param {number} props.pxPerMin
 * @param {boolean} props.showConsequences
 * @param {boolean} props.scrollRevealConsequences
 * @param {boolean} props.reducedMotion
 */
function JourneyColumn({
  persona,
  segments,
  compareSegments,
  ui,
  variant,
  ariaLabel,
  pxPerMin,
  showConsequences,
  scrollRevealConsequences,
  reducedMotion,
}) {
  const trackRef = useRef(null);
  const [spineProgress, setSpineProgress] = useState(() => (reducedMotion ? 1 : 0));

  useLayoutEffect(() => {
    if (reducedMotion) {
      setSpineProgress(1);
      return undefined;
    }
    const el = trackRef.current;
    if (!el) return undefined;
    const tick = () => {
      const rect = el.getBoundingClientRect();
      const h = Math.max(rect.height, 1);
      const mid = window.innerHeight * 0.5;
      // 0 until the track reaches the viewport midline; fills to 1 as the midline sweeps to the track bottom
      const raw = (mid - rect.top) / h;
      setSpineProgress(Math.min(1, Math.max(0, raw)));
    };
    tick();
    window.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    const ro = new ResizeObserver(tick);
    ro.observe(el);
    return () => {
      window.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      ro.disconnect();
    };
  }, [reducedMotion, segments]);

  const photoIndices = useMemo(() => {
    let n = 0;
    return segments.map((seg) => ({
      step: seg.stepPhoto != null ? n++ : null,
      arrival: seg.arrivalPhoto != null ? n++ : null,
    }));
  }, [segments]);

  const isManageable = persona.afterCut.type === "manageable";
  const footerClass = isManageable ? styles.footerManageable : styles.footerCritical;
  const footerTitleClass = isManageable ? styles.footerTitleManageable : styles.footerTitleCritical;
  const footerTitle = isManageable ? ui.manageableFooterTitle : ui.criticalFooterTitle;

  const totalNow = sumMinutes(segments);
  const totalBefore = compareSegments ? sumMinutes(compareSegments) : null;
  const delta = totalBefore != null ? totalNow - totalBefore : null;
  const statRows = compareSegments != null && persona.statsAfter?.length ? persona.statsAfter : persona.stats;

  return (
    <article className={styles.journeyCard} aria-label={ariaLabel}>
      <header className={`${styles.journeyCardHead} ${variant === "a" ? styles.journeyCardHeadA : styles.journeyCardHeadB}`}>
        <span className={styles.tag}>{persona.tag}</span>
        <h3 className={styles.name}>{persona.name}</h3>
        <p className={styles.meta}>
          {persona.neighborhood}
          <br />
          {persona.incomeLabel}
        </p>
        <span className={styles.carBadge}>{persona.carStatusLabel}</span>
      </header>

      <div ref={trackRef} className={styles.track} role="group" aria-label={ui.timelineHeading}>
        <div
          className={styles.trackSpine}
          aria-hidden
          style={{ ["--spine-progress"]: spineProgress }}
        />

        <div className={styles.trackNodeRow}>
          <span className={styles.dot} aria-hidden />
          <span className={styles.mono}>{persona.startNodeLabel ?? "Home"}</span>
        </div>

        {segments.map((seg, i) => {
          const minH = Math.max(56, seg.minutes * pxPerMin);
          const stepSide = seg.stepPhoto ? seg.stepPhoto.side ?? "right" : null;
          const arrSide = seg.arrivalPhoto ? seg.arrivalPhoto.side ?? "right" : null;
          const pi = photoIndices[i];

          return (
            <Fragment key={i}>
              <div className={styles.trackSegRow} style={{ minHeight: `${minH}px` }}>
                {seg.stepPhoto && stepSide === "left" && pi.step != null ? (
                  <JourneyStopVisual
                    image={seg.stepPhoto}
                    frameClass={styles.journeyThumbSeg}
                    placeholderIndex={pi.step}
                  />
                ) : null}
                <div className={styles.segmentTextCol}>
                  <span className={styles.edgeLabel}>{seg.edgeLabel}</span>
                  <span className={styles.minutesBadge} aria-label={`${seg.minutes} minutes`}>
                    ~{seg.minutes} min
                  </span>
                </div>
                {seg.stepPhoto && stepSide === "right" && pi.step != null ? (
                  <JourneyStopVisual
                    image={seg.stepPhoto}
                    frameClass={styles.journeyThumbSeg}
                    placeholderIndex={pi.step}
                  />
                ) : null}
              </div>
              <div className={styles.trackNodeRow}>
                <span className={styles.dot} aria-hidden />
                {seg.arrivalPhoto && arrSide === "left" && pi.arrival != null ? (
                  <JourneyStopVisual
                    image={seg.arrivalPhoto}
                    frameClass={styles.journeyThumbNode}
                    placeholderIndex={pi.arrival}
                  />
                ) : null}
                <span className={styles.mono}>{seg.nodeLabel}</span>
                {seg.arrivalPhoto && arrSide === "right" && pi.arrival != null ? (
                  <JourneyStopVisual
                    image={seg.arrivalPhoto}
                    frameClass={styles.journeyThumbNode}
                    placeholderIndex={pi.arrival}
                  />
                ) : null}
              </div>
            </Fragment>
          );
        })}
      </div>

      <div className={styles.statsRow} aria-label={ui.statsHeading}>
        {statRows.map((s, i) => (
          <div key={i} className={styles.statPill}>
            <span className={styles.statValue}>{s.value}</span>
            <span className={styles.statLabel}>{s.label}</span>
          </div>
        ))}
        {delta != null && delta > 0 ? (
          <div className={`${styles.statPill} ${styles.statPillDelta}`}>
            <span className={styles.statValue}>+{delta} min</span>
            <span className={styles.statLabel}>vs before</span>
          </div>
        ) : null}
      </div>

      {showConsequences ? (
        <footer className={`${styles.footer} ${footerClass}`}>
          <p className={`${styles.footerTitle} ${footerTitleClass}`}>
            {ui.consequencesHeading}: {footerTitle}
          </p>
          <ul className={styles.consequences} aria-label={footerTitle}>
            {persona.afterCut.items.map((text, i) =>
              scrollRevealConsequences ? (
                <ScrollRevealItem key={i} text={text} />
              ) : (
                <li key={i} className={styles.consequence}>
                  {text}
                </li>
              ),
            )}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}

/**
 * @param {{ text: string }} props
 */
function ScrollRevealItem({ text }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { root: null, rootMargin: "0px 0px -12% 0px", threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <li
      ref={ref}
      className={`${styles.consequence} ${styles.reveal} ${visible ? styles.revealVisible : ""}`}
    >
      {text}
    </li>
  );
}
