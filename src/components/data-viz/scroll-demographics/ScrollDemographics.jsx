"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { scrollDemographicsStructure } from "../../../data/structure";
import { scrollDemographicsNarrative as defaultNarrative } from "./scrollDemographicsNarrative";
import { DataRationaleIcon } from "../../ui/DataRationaleIcon";
import styles from "./ScrollDemographics.module.css";

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

function formatRiders(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

/**
 * Polyline split at stops; stroke width encodes a neighborhood metric per segment (average of endpoints, 0–1).
 * @param {Array<{ x: number; y: number }>} pts
 * @param {(p: object) => number} norm01
 * @param {number} swMin
 * @param {number} swMax
 */
function routeVariableSegments(pts, norm01, swMin, swMax) {
  if (pts.length < 2) return [];
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const t = Math.min(1, Math.max(0, (norm01(a) + norm01(b)) * 0.5));
    segs.push({
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      sw: swMin + t * (swMax - swMin),
    });
  }
  return segs;
}

/**
 * @param {object} props
 * @param {typeof defaultNarrative} [props.narrative]
 */
export function ScrollDemographics({ narrative = defaultNarrative }) {
  const { ui, routes, steps } = narrative;
  const [step, setStep] = useState(0);
  const keepPathRef = useRef(null);
  const cutPathRef = useRef(null);
  const [keepPts, setKeepPts] = useState([]);
  const [cutPts, setCutPts] = useState([]);
  const reduceMotion = usePrefersReducedMotion();

  useLayoutEffect(() => {
    const sample = (pathEl, stopList) => {
      if (!pathEl) return [];
      const len = pathEl.getTotalLength();
      return stopList.map((s) => {
        const pt = pathEl.getPointAtLength(Math.min(len * s.t, len));
        return { ...s, x: pt.x, y: pt.y };
      });
    };
    setKeepPts(sample(keepPathRef.current, routes.keep.stops));
    setCutPts(sample(cutPathRef.current, routes.cut.stops));
  }, [routes.keep.pathD, routes.cut.pathD, routes.keep.stops, routes.cut.stops]);

  const stepRefs = useRef(/** @type {(HTMLElement | null)[]} */ ([]));
  const maxKeepR = useMemo(
    () => Math.max(...routes.keep.stops.map((s) => s.ridership), 1),
    [routes.keep.stops],
  );
  const maxCutR = useMemo(
    () => Math.max(...routes.cut.stops.map((s) => s.ridership), 1),
    [routes.cut.stops],
  );

  const maxKeepPoverty = useMemo(
    () => Math.max(1, ...routes.keep.stops.map((s) => s.povertyPct)),
    [routes.keep.stops],
  );
  const maxCutPoverty = useMemo(
    () => Math.max(1, ...routes.cut.stops.map((s) => s.povertyPct)),
    [routes.cut.stops],
  );

  const ridershipKeepSegs = useMemo(
    () => routeVariableSegments(keepPts, (p) => p.ridership / maxKeepR, 1.5, 11),
    [keepPts, maxKeepR],
  );
  const ridershipCutSegs = useMemo(
    () => routeVariableSegments(cutPts, (p) => p.ridership / maxCutR, 1.5, 9.5),
    [cutPts, maxCutR],
  );
  const povertyKeepSegs = useMemo(
    () => routeVariableSegments(keepPts, (p) => p.povertyPct / maxKeepPoverty, 2, 12),
    [keepPts, maxKeepPoverty],
  );
  const povertyCutSegs = useMemo(
    () => routeVariableSegments(cutPts, (p) => p.povertyPct / maxCutPoverty, 2.2, 14),
    [cutPts, maxCutPoverty],
  );
  const transitKeepSegs = useMemo(
    () => routeVariableSegments(keepPts, (p) => (p.transitPct ?? 0) / 100, 1.8, 11),
    [keepPts],
  );
  const transitCutSegs = useMemo(
    () => routeVariableSegments(cutPts, (p) => (p.transitPct ?? 0) / 100, 1.8, 12),
    [cutPts],
  );

  useLayoutEffect(() => {
    if (reduceMotion) return undefined;
    const els = stepRefs.current.filter(Boolean);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.12)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!hit) return;
        const idx = Number(hit.target.getAttribute("data-step-index"));
        if (Number.isFinite(idx)) setStep(idx);
      },
      { root: null, rootMargin: "-36% 0px -36% 0px", threshold: [0, 0.12, 0.28, 0.45] },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [reduceMotion, steps.length]);

  const overlay = steps[step]?.overlay || "poverty";
  const effectiveOverlay = reduceMotion ? "poverty" : overlay;
  const sectionTitleVis = String(ui.sectionTitle ?? "").trim();

  return (
    <section className={styles.wrap} aria-labelledby="scroll-demographics-title">
      <header className={styles.head}>
        <h2
          id="scroll-demographics-title"
          className={sectionTitleVis ? styles.leadTitle : "sr-only"}
        >
          {sectionTitleVis || "Compare two corridors"}
        </h2>
        <p className={styles.leadBody}>
          <span className={styles.routeCorridorKeys} aria-label="Illustrated route line colors">
            <span className={styles.routeKeyWithSwatch}>
              <span
                className={styles.routeLineSwatch}
                style={{ backgroundColor: routes.keep.lineColor }}
                aria-hidden
              />
              {routes.keep.routeCode}
            </span>
            <span className={styles.routeKeySep} aria-hidden>
              ·
            </span>
            <span className={styles.routeKeyWithSwatch}>
              <span
                className={styles.routeLineSwatch}
                style={{ backgroundColor: routes.cut.lineColor }}
                aria-hidden
              />
              {routes.cut.routeCode}
            </span>
          </span>
          {" — "}
          {ui.sectionIntro}
        </p>
      </header>

      <div className={styles.shell} data-layout-id={scrollDemographicsStructure.shell.id}>
        <div className={styles.sticky}>
          <figure className={styles.figure} aria-label={ui.stickyAriaLabel}>
            <svg className={styles.svg} viewBox="0 0 400 360" role="img">
              <title>{ui.stickyAriaLabel}</title>
              <path
                className={styles.citySilhouette}
                d="M 8 328 Q 100 278 188 298 Q 248 312 318 302 Q 352 298 392 320 L 392 356 L 6 356 Z"
              />

              <path ref={keepPathRef} className={styles.routeSamplePath} d={routes.keep.pathD} />
              <path ref={cutPathRef} className={styles.routeSamplePath} d={routes.cut.pathD} />

              <g
                className={`${styles.overlayLayer} ${effectiveOverlay === "ridership" ? styles.overlayVisible : styles.overlayHidden}`}
              >
                {ridershipKeepSegs.map((s, i) => (
                  <line
                    key={`kr-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegKeep}
                  />
                ))}
                {ridershipCutSegs.map((s, i) => (
                  <line
                    key={`cr-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegCut}
                  />
                ))}
                {keepPts[2] ? (
                  <g aria-hidden>
                    <line
                      x1={keepPts[2].x}
                      y1={keepPts[2].y + 12}
                      x2={keepPts[2].x}
                      y2={keepPts[2].y + 18}
                      className={styles.leaderLine}
                    />
                    <text
                      x={keepPts[2].x}
                      y={keepPts[2].y + 28}
                      className={styles.valueLabelRidership}
                      textAnchor="middle"
                    >
                      {formatRiders(routes.keep.summaryRidershipRecent)}
                    </text>
                  </g>
                ) : null}
                {cutPts[2] ? (
                  <g aria-hidden>
                    <line
                      x1={cutPts[2].x}
                      y1={cutPts[2].y + 12}
                      x2={cutPts[2].x}
                      y2={cutPts[2].y + 18}
                      className={styles.leaderLine}
                    />
                    <text
                      x={cutPts[2].x}
                      y={cutPts[2].y + 28}
                      className={styles.valueLabelRidership}
                      textAnchor="middle"
                    >
                      {formatRiders(routes.cut.summaryRidershipRecent)}
                    </text>
                  </g>
                ) : null}
              </g>

              <g
                className={`${styles.overlayLayer} ${effectiveOverlay === "poverty" ? styles.overlayVisible : styles.overlayHidden}`}
              >
                {povertyKeepSegs.map((s, i) => (
                  <line
                    key={`kp-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegKeep}
                  />
                ))}
                {povertyCutSegs.map((s, i) => (
                  <line
                    key={`cp-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegCut}
                  />
                ))}
                {keepPts.map((p, i) => (
                  <g key={`kpl-${i}`} aria-hidden>
                    <line
                      x1={p.x}
                      y1={p.y + 10}
                      x2={p.x}
                      y2={p.y + 15}
                      className={styles.leaderLine}
                    />
                    <text
                      x={p.x}
                      y={p.y + 25}
                      className={styles.valueLabelPoverty}
                      textAnchor="middle"
                    >
                      {Math.round(p.povertyPct)}%
                    </text>
                  </g>
                ))}
                {cutPts.map((p, i) => (
                  <g key={`cpl-${i}`} aria-hidden>
                    <line
                      x1={p.x}
                      y1={p.y + 10}
                      x2={p.x}
                      y2={p.y + 15}
                      className={styles.leaderLine}
                    />
                    <text
                      x={p.x}
                      y={p.y + 25}
                      className={styles.valueLabelPoverty}
                      textAnchor="middle"
                    >
                      {Math.round(p.povertyPct)}%
                    </text>
                  </g>
                ))}
                <text x="14" y="22" className={styles.summaryChip}>
                  Areas poverty % · {routes.keep.summaryPovertyCount} below line (
                  {routes.keep.summaryPovertyPct}% route composite)
                </text>
                <text x="14" y="188" className={styles.summaryChip}>
                  Areas poverty % · {routes.cut.summaryPovertyCount} below line (
                  {routes.cut.summaryPovertyPct}% route composite)
                </text>
              </g>

              <g
                className={`${styles.overlayLayer} ${effectiveOverlay === "transit" ? styles.overlayVisible : styles.overlayHidden}`}
              >
                {transitKeepSegs.map((s, i) => (
                  <line
                    key={`kt-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegKeep}
                  />
                ))}
                {transitCutSegs.map((s, i) => (
                  <line
                    key={`ct-${i}`}
                    x1={s.x1}
                    y1={s.y1}
                    x2={s.x2}
                    y2={s.y2}
                    strokeWidth={s.sw}
                    className={styles.routeSegCut}
                  />
                ))}
                <text x="14" y="22" className={styles.summaryChip}>
                  Transit commute share (workers) · {routes.keep.summaryTransitCommutePct}%
                </text>
                <text x="14" y="188" className={styles.summaryChip}>
                  Transit commute share (workers) · {routes.cut.summaryTransitCommutePct}%
                </text>
              </g>

              <text x="318" y="58" className={styles.routeCodeKeep} textAnchor="end">
                {routes.keep.routeCode}
              </text>
              <text x="388" y="312" className={styles.routeCodeCut} textAnchor="end">
                {routes.cut.routeCode}
              </text>
            </svg>
            <div className={styles.legend}>
              {effectiveOverlay === "ridership" ? ui.legendRidership : null}
              {effectiveOverlay === "poverty" ? ui.legendPoverty : null}
              {effectiveOverlay === "transit" ? ui.legendTransit : null}
            </div>
            {reduceMotion ? <p className={styles.motionNote}>{ui.reducedMotionNote}</p> : null}
            <div className={styles.sourceRow}>
              <span className={styles.sourceLabel}>Sources & methods</span>
              <DataRationaleIcon
                label="Data sources and methods for this graphic"
                rationale={`${ui.legendRidership}\n\n${ui.legendPoverty}\n\n${ui.legendTransit}\n\n${ui.sourceNote}`}
              />
            </div>
          </figure>
        </div>

        <div className={styles.steps}>
          {steps.map((s, i) => (
            <article
              key={s.id}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              data-step-index={i}
              className={`${styles.step} ${!reduceMotion && step === i ? styles.stepActive : ""}`}
            >
              <div className={styles.stepIndex}>
                {i + 1} / {steps.length}
              </div>
              <h3 className={styles.stepTitle}>{s.title}</h3>
              {s.body?.trim() ? <p className={styles.stepBody}>{s.body}</p> : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
