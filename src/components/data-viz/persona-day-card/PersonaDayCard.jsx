"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { personaDayCardNarrative as defaultNarrative } from "../../../data/narrative";
import { useVerticalPinScrub } from "../../../lib/persona-journey/useVerticalPinScrub";
import { storyExperienceStructure } from "../../../data/structure";
import { GalleryRow } from "../../layout/GalleryRow";
import { DataRationaleIcon } from "../../ui/DataRationaleIcon";
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
 *   daySchedule?: { heading?: string; beforeRows: { time: string; label: string }[]; afterRows: { time: string; label: string }[] };
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
 * @param {Persona} props.persona
 * @param {'before' | 'after'} props.schedulePhase
 * @param {'a' | 'b'} props.variant
 */
function PersonaHead({ persona, schedulePhase, variant }) {
  return (
    <div className={`${styles.journeyCard} ${styles.personaHeadCard}`}>
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

      {persona.daySchedule ? (
        <div
          className={styles.daySchedule}
          aria-label={
            schedulePhase === "after"
              ? "Illustrative day anchors and clock after service changes"
              : "Illustrative day anchors and clock before service changes"
          }
        >
          {persona.daySchedule.heading ? (
            <p className={styles.dayScheduleHeading}>{persona.daySchedule.heading}</p>
          ) : null}
          <ul className={styles.dayScheduleList}>
            {(schedulePhase === "after" ? persona.daySchedule.afterRows : persona.daySchedule.beforeRows).map((row, i) => (
              <li key={i} className={styles.dayScheduleItem}>
                {row.time ? (
                  <span className={styles.dayScheduleTime}>{row.time}</span>
                ) : (
                  <span className={styles.dayScheduleTimePlaceholder} aria-hidden />
                )}
                <span className={styles.dayScheduleLabel}>{row.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * @param {object} props
 * @param {Persona} props.persona
 * @param {JourneySegment[]} props.segments
 * @param {string} props.ariaLabel — column screen-reader label
 * @param {number} props.pxPerMin
 * @param {number | null} props.pinScrubProgress — 0–1 from vertical pin scroll; null = manual horizontal scroll + spine from overflow
 * @param {import("react").RefObject<HTMLDivElement | null> | undefined} props.trackRef
 * @param {import("react").RefObject<HTMLDivElement | null> | undefined} props.railRef
 */
function PersonaJourneyRail({ persona, segments, ariaLabel, pxPerMin, pinScrubProgress, trackRef, railRef }) {
  const [scrollSpine, setScrollSpine] = useState(0);
  const [maxTx, setMaxTx] = useState(0);
  const internalTrackRef = useRef(null);
  const internalRailRef = useRef(null);
  const trackDomRef = pinScrubProgress != null && trackRef ? trackRef : internalTrackRef;
  const railDomRef = pinScrubProgress != null && railRef ? railRef : internalRailRef;

  useLayoutEffect(() => {
    if (pinScrubProgress != null) {
      const t = trackDomRef.current;
      const r = railDomRef.current;
      if (!t || !r) return undefined;
      const measure = () => setMaxTx(Math.max(0, r.scrollWidth - t.clientWidth));
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(t);
      ro.observe(r);
      return () => ro.disconnect();
    }

    const el = internalTrackRef.current;
    if (!el) return undefined;
    const tick = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      const raw = maxScroll <= 0 ? 1 : el.scrollLeft / maxScroll;
      setScrollSpine(Math.min(1, Math.max(0, raw)));
    };
    tick();
    el.addEventListener("scroll", tick, { passive: true });
    window.addEventListener("resize", tick);
    const ro = new ResizeObserver(tick);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", tick);
      window.removeEventListener("resize", tick);
      ro.disconnect();
    };
  }, [pinScrubProgress, segments, trackDomRef, railDomRef]);

  const photoIndices = useMemo(() => {
    let n = 0;
    return segments.map((seg) => ({
      step: seg.stepPhoto != null ? n++ : null,
      arrival: seg.arrivalPhoto != null ? n++ : null,
    }));
  }, [segments]);

  const spineP = pinScrubProgress != null ? pinScrubProgress : scrollSpine;
  const translateX = pinScrubProgress != null ? -pinScrubProgress * maxTx : 0;

  const trackClass =
    pinScrubProgress != null ? `${styles.horizTrack} ${styles.horizTrackPinned}` : styles.horizTrack;

  return (
    <div className={styles.journeyRailBlock}>
      {pinScrubProgress != null ? <p className={styles.journeyRailPersonaLabel}>{persona.name}</p> : null}
      <div
        ref={trackDomRef}
        className={trackClass}
        role="group"
        aria-label={ariaLabel}
        tabIndex={pinScrubProgress != null ? -1 : 0}
      >
        {pinScrubProgress == null ? (
          <p className={styles.horizScrollHint}>Scroll horizontally to follow the journey</p>
        ) : null}
        <div
          ref={railDomRef}
          className={styles.horizRail}
          style={pinScrubProgress != null ? { transform: `translateX(${translateX}px)` } : undefined}
        >
          <div className={styles.horizSpineHost} aria-hidden>
            <div className={styles.horizSpineBase} />
            <div className={styles.horizSpineFill} style={{ ["--spine-progress"]: spineP }} />
          </div>

          <div className={styles.horizRow}>
            <div className={styles.horizNode}>
              <span className={styles.dot} aria-hidden />
              <span className={styles.mono}>{persona.startNodeLabel ?? "Home"}</span>
            </div>

            {segments.map((seg, i) => {
              const segW = Math.max(56, seg.minutes * pxPerMin);
              const stepSide = seg.stepPhoto ? seg.stepPhoto.side ?? "right" : null;
              const arrSide = seg.arrivalPhoto ? seg.arrivalPhoto.side ?? "right" : null;
              const pi = photoIndices[i];
              const isWalk = seg.edgeKind === "firstMile" || seg.edgeKind === "uncertain";

              return (
                <Fragment key={i}>
                  <div
                    className={`${styles.horizSeg} ${isWalk ? styles.horizSegWalk : styles.horizSegTransit}`}
                    style={{ minWidth: `${segW}px` }}
                  >
                    <div className={styles.horizSegInner}>
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
                  </div>
                  <div className={styles.horizNode}>
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
        </div>
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {Persona} props.persona
 * @param {JourneySegment[]} props.segments
 * @param {JourneySegment[] | null} props.compareSegments
 * @param {PersonaDayUi} props.ui
 * @param {'a' | 'b'} props.variant
 * @param {boolean} props.showConsequences
 * @param {boolean} props.scrollRevealConsequences
 */
function PersonaTail({ persona, segments, compareSegments, ui, variant, showConsequences, scrollRevealConsequences }) {
  const isManageable = persona.afterCut.type === "manageable";
  const footerClass = isManageable ? styles.footerManageable : styles.footerCritical;
  const footerTitleClass = isManageable ? styles.footerTitleManageable : styles.footerTitleCritical;
  const footerTitle = isManageable ? ui.manageableFooterTitle : ui.criticalFooterTitle;

  const totalNow = sumMinutes(segments);
  const totalBefore = compareSegments ? sumMinutes(compareSegments) : null;
  const delta = totalBefore != null ? totalNow - totalBefore : null;
  const statRows = compareSegments != null && persona.statsAfter?.length ? persona.statsAfter : persona.stats;

  return (
    <div className={`${styles.journeyCard} ${styles.personaTailCard}`}>
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
    </div>
  );
}

/**
 * @param {object} props
 * @param {PersonaDayNarrative} [props.narrative]
 * @param {boolean} [props.showSectionHeading]
 * @param {'before' | 'after'} [props.phase]
 * @param {string} [props.layoutRowId]
 */
export function PersonaDayCard({
  narrative = defaultNarrative,
  showSectionHeading = false,
  phase = "before",
  layoutRowId,
}) {
  const { personas, ui } = narrative;
  const reducedMotion = usePrefersReducedMotion();
  const pxPerMin = reducedMotion ? 3.5 : 8.25;

  const isAfter = phase === "after";
  const headingId = isAfter ? "persona-day-heading-after" : "persona-day-heading-before";
  const titleRaw = isAfter ? ui.sectionHeadingAfter ?? ui.sectionHeading : ui.sectionHeadingBefore ?? ui.sectionHeading;
  const title = String(titleRaw ?? "").trim();
  const dek = isAfter ? ui.sectionAfterDek : ui.sectionBeforeDek;
  const dekText = String(dek ?? "").trim();
  const srFallback = isAfter ? "After service changes" : "Persona journeys";
  const hasVisibleHeading = showSectionHeading && (title || dekText);
  const personaRowDef = isAfter ? storyExperienceStructure.personaAfter : storyExperienceStructure.personaBefore;
  const personaLayoutId = layoutRowId ?? personaRowDef.id;

  const pinOuterRef = useRef(null);
  const trackARef = useRef(null);
  const trackBRef = useRef(null);
  const railARef = useRef(null);
  const railBRef = useRef(null);
  const [pinOuterHeightPx, setPinOuterHeightPx] = useState(null);

  const scrubP = useVerticalPinScrub(pinOuterRef);

  const schedulePhase = isAfter ? "after" : "before";
  const segA = isAfter ? personas.a.journeyAfter : personas.a.journeyBefore;
  const segB = isAfter ? personas.b.journeyAfter : personas.b.journeyBefore;
  const cmpA = isAfter ? personas.a.journeyBefore : null;
  const cmpB = isAfter ? personas.b.journeyBefore : null;

  useLayoutEffect(() => {
    if (reducedMotion) return undefined;

    const measure = () => {
      const t = trackARef.current;
      const rA = railARef.current;
      const rB = railBRef.current;
      if (!t || !rA || !rB) return;
      const cw = t.clientWidth;
      const maxO = Math.max(0, rA.scrollWidth - cw, rB.scrollWidth - cw);
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      setPinOuterHeightPx(Math.max(vh * 0.35, maxO + vh));
    };

    measure();
    window.addEventListener("resize", measure);
    const ro = new ResizeObserver(measure);
    if (trackARef.current) ro.observe(trackARef.current);
    if (railARef.current) ro.observe(railARef.current);
    if (railBRef.current) ro.observe(railBRef.current);
    if (pinOuterRef.current) ro.observe(pinOuterRef.current);
    return () => {
      window.removeEventListener("resize", measure);
      ro.disconnect();
    };
  }, [reducedMotion, phase, segA, segB, pinOuterRef]);

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={hasVisibleHeading ? styles.sectionHeadingVisible : "sr-only"}>
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

      {reducedMotion ? (
        <GalleryRow
          variant={personaRowDef.variant}
          measure={personaRowDef.measure}
          layoutId={personaLayoutId}
          className={styles.personaGalleryRow}
        >
          <JourneyColumnReduced
            persona={personas.a}
            segments={segA}
            compareSegments={cmpA}
            schedulePhase={schedulePhase}
            ui={ui}
            variant="a"
            ariaLabel={ui.columnAriaLabelA}
            pxPerMin={pxPerMin}
            showConsequences={isAfter}
            scrollRevealConsequences={false}
          />
          <JourneyColumnReduced
            persona={personas.b}
            segments={segB}
            compareSegments={cmpB}
            schedulePhase={schedulePhase}
            ui={ui}
            variant="b"
            ariaLabel={ui.columnAriaLabelB}
            pxPerMin={pxPerMin}
            showConsequences={isAfter}
            scrollRevealConsequences
          />
        </GalleryRow>
      ) : (
        <>
          <GalleryRow
            variant={personaRowDef.variant}
            measure={personaRowDef.measure}
            layoutId={personaLayoutId}
            className={styles.personaGalleryRow}
          >
            <PersonaHead persona={personas.a} schedulePhase={schedulePhase} variant="a" />
            <PersonaHead persona={personas.b} schedulePhase={schedulePhase} variant="b" />
          </GalleryRow>

          <div
            ref={pinOuterRef}
            className={styles.journeyPinOuter}
            style={pinOuterHeightPx != null ? { height: `${pinOuterHeightPx}px` } : { minHeight: "min(140vh, 56rem)" }}
          >
            <div className={styles.journeyPinSticky}>
              <p className={styles.journeyPinHint}>Scroll down to move through each journey</p>
              <div className={styles.journeyPinRows}>
                <PersonaJourneyRail
                  persona={personas.a}
                  segments={segA}
                  ariaLabel={ui.columnAriaLabelA}
                  pxPerMin={pxPerMin}
                  pinScrubProgress={scrubP}
                  trackRef={trackARef}
                  railRef={railARef}
                />
                <PersonaJourneyRail
                  persona={personas.b}
                  segments={segB}
                  ariaLabel={ui.columnAriaLabelB}
                  pxPerMin={pxPerMin}
                  pinScrubProgress={scrubP}
                  trackRef={trackBRef}
                  railRef={railBRef}
                />
              </div>
            </div>
          </div>

          <GalleryRow variant={personaRowDef.variant} measure={personaRowDef.measure} className={styles.personaGalleryRow}>
            <PersonaTail
              persona={personas.a}
              segments={segA}
              compareSegments={cmpA}
              ui={ui}
              variant="a"
              showConsequences={isAfter}
              scrollRevealConsequences={false}
            />
            <PersonaTail
              persona={personas.b}
              segments={segB}
              compareSegments={cmpB}
              ui={ui}
              variant="b"
              showConsequences={isAfter}
              scrollRevealConsequences
            />
          </GalleryRow>
        </>
      )}

      {ui.journeyScaleNote?.trim() || ui.sharedRouteNote?.trim() ? (
        <div className={styles.methodNoteRow} role="group" aria-label="Method notes">
          {ui.journeyScaleNote?.trim() ? (
            <DataRationaleIcon label="How journey leg widths are scaled" rationale={ui.journeyScaleNote.trim()} />
          ) : null}
          {ui.sharedRouteNote?.trim() ? (
            <DataRationaleIcon label="How route cuts and consequences are modeled" rationale={ui.sharedRouteNote.trim()} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * Reduced motion: full stacked column with manual horizontal scroll on each rail.
 * @param {object} props
 * @param {Persona} props.persona
 * @param {JourneySegment[]} props.segments
 * @param {JourneySegment[] | null} props.compareSegments
 * @param {'before' | 'after'} props.schedulePhase
 * @param {PersonaDayUi} props.ui
 * @param {'a' | 'b'} props.variant
 * @param {string} props.ariaLabel
 * @param {number} props.pxPerMin
 * @param {boolean} props.showConsequences
 * @param {boolean} props.scrollRevealConsequences
 */
function JourneyColumnReduced({
  persona,
  segments,
  compareSegments,
  schedulePhase,
  ui,
  variant,
  ariaLabel,
  pxPerMin,
  showConsequences,
  scrollRevealConsequences,
}) {
  return (
    <article className={styles.journeyCard} aria-label={ariaLabel}>
      <PersonaHead persona={persona} schedulePhase={schedulePhase} variant={variant} />
      <PersonaJourneyRail
        persona={persona}
        segments={segments}
        ariaLabel={ariaLabel}
        pxPerMin={pxPerMin}
        pinScrubProgress={null}
      />
      <PersonaTail
        persona={persona}
        segments={segments}
        compareSegments={compareSegments}
        ui={ui}
        variant={variant}
        showConsequences={showConsequences}
        scrollRevealConsequences={scrollRevealConsequences}
      />
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
    <li ref={ref} className={`${styles.consequence} ${styles.reveal} ${visible ? styles.revealVisible : ""}`}>
      {text}
    </li>
  );
}
