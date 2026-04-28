"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { NeighborhoodPanelProvider } from "../../contexts/NeighborhoodPanelContext";
import { getRidershipTotalsByPovertyTier } from "../../lib/routeData";
import CoverageMap from "../coverage-map/CoverageMap";
import CovidRecoveryDotsComparison from "../covid-recovery/CovidVis";
import BusRouteComparison from "../bus-route-comparison/BusRouteComparison";
import CommuteMethodGauge from "../info-panel/components/CommuteVis";
import PovertyPictogram from "../info-panel/components/IncomeVis";
import useScrollBeat from "../../lib/hooks/useScrollBeat";
import styles from "./GuidedStory.module.css";

// ─── Verified data constants ──────────────────────────────────────────────────
// All figures cross-checked against project data files; discrepancies noted.

// Beat 3 — confirmed counts from route_status_official.csv (100 routes total).
const FY26_ROUTES_ELIMINATED = 41; // CSV: 41 rows with route_status="eliminated"
const FY26_ROUTES_REDUCED = 57;    // CSV: 57 rows with route_status="reduced"
// Stops lost: not in CSV; keep as estimate until GTFS stop_times analysis is run.
const FY26_STOPS_LOST = 171;

// Beat 3 — confirmed eliminated route highlights (all verified in CSV).
// Y-flyers: Y1, Y45, Y47, Y49 — all eliminated.
// O-flyers: O1, O12, O5 — all eliminated.
const ELIMINATED_HIGHLIGHTS = [
  { code: "71", note: "Edgewood Town Center" },
  { code: "65", note: "Squirrel Hill" },
  { code: "P10", note: "" },
  { code: "P17", note: "" },
  { code: "SLVR", note: "Silver Line" }, // CSV spells "Libary via Overbrook"
  { code: "P16", note: "" },
  { code: "P7", note: "" },
  { code: "Y1", note: "" },
  { code: "Y45", note: "" },
  { code: "Y47", note: "" },
  { code: "Y49", note: "" },
  { code: "O1", note: "" },
  { code: "O12", note: "" },
  { code: "O5", note: "" },
];

// Reduced route highlights — all confirmed reduced in CSV.
const REDUCED_HIGHLIGHTS = ["71A", "71B", "71C", "71D", "74", "77", "82", "86"];

// ─── Beat 4 comparison data ───────────────────────────────────────────────────
// Source: display_profiles_2024.csv (neighborhood rows) +
//         route_status_official.csv (ridership rows).
// DISCREPANCY NOTES:
//   • Prompt said Larimer poverty 41%; CSV share_below_100pct_poverty_threshold = 32.8%
//   • Prompt said Larimer population 1,574; CSV total_pop = 1,473
//   • Prompt said Highland Park population 6,200; CSV total_pop = 2,364
//   • CSV has no car-ownership column; share_commute_car_truck_van is commute mode
//   • Route 74 ridership: baseline 975.6, recent 676.5 (CSV) → using 976/677
//   • Route 71B ridership: baseline 5020.1, recent 3958.4 (CSV) → using 5,020/3,958
const COMPARISON_CARDS = [
  {
    hood: "Larimer",
    accentColor: "var(--r2)",
    povertyShare: 0.328,
    deepPovertyShare: 0.150552486,
    highIncomeHouseholdShare: 0.097315436,
    workFromHomeShare: 0.064516129,
    vehicleWalkShare: 0.709677419,
    transitShare: 0.221,
    totalPop: 1473,
    layer2: [
      { label: "Transit dependence", value: "High — no car alternative", highlight: true },
      { label: "P10 / P17", value: "Eliminated", highlight: true },
      { label: "Impact", value: "Fewer buses on only remaining routes", highlight: true },
    ],
  },
  {
    hood: "Highland Park",
    accentColor: "var(--b5)",
    povertyShare: 0.071,
    deepPovertyShare: 0.019853056,
    highIncomeHouseholdShare: 0.524605983,
    workFromHomeShare: 0.300766757,
    vehicleWalkShare: 0.588671779,
    transitShare: 0.1,
    totalPop: 2364,
    layer2: [
      { label: "Transit dependence", value: "Low — cars available", highlight: false },
      { label: "71B daytime service", value: "Mostly preserved", highlight: false },
      { label: "Impact", value: "Late-night service lost; can adjust", highlight: false },
    ],
  },
];

// ─── Beat 6 — verified stop IDs and route data ────────────────────────────────
// Larimer stop: E70267 — LARIMER AVE AT MEADOW ST — confirmed on Route 74
//   in route_stop_per_route.csv (also E70268 for opposite direction).
// DISCREPANCY: Route 74 is route_status="reduced" (tier=major) in CSV,
//   NOT eliminated as the original prompt implied. Persona copy updated accordingly.
const LARIMER_STOP = { id: "E70267", name: "Larimer Ave at Meadow St" };
const LARIMER_ROUTES = [
  {
    id: "74",
    label: "74",
    color: "#B94033", // --r3; Homewood–Squirrel Hill corridor
    // CSV: route_status=reduced, reduction_tier=major → ~50% frequency cut
    headwayBefore: 30,
    headwayAfter: 60,
    status: "reduced",
  },
  {
    id: "86",
    label: "86",
    color: "#38777D", // --b7
    // CSV: route_status=reduced, reduction_tier=minor → ~25% frequency cut
    headwayBefore: 30,
    headwayAfter: 30,
    status: "reduced",
  },
];

// Highland Park stop: E29055 — HIGHLAND AVE AT PENN AVE — confirmed on Route 71B
//   in route_stop_per_route.csv. (Note: file lists as "HIGHLAND AVE AT PENN AVE";
//   prompt reversed order to "PENN AVE AT HIGHLAND AVE" — using verified name.)
// CSV: 71B route_status=reduced, reduction_tier=minor.
//   Main cut is 11pm+ service; daytime frequency mostly preserved.
const HIGHLAND_STOP = { id: "E29055", name: "Highland Ave at Penn Ave" };
const HIGHLAND_ROUTES = [
  {
    id: "71B",
    label: "71B",
    color: "#6CABB1", // --b5; Highland Park corridor
    // CSV: route_status=reduced, reduction_tier=minor
    // Daytime headway mostly preserved; primary change = no service after 11pm
    headwayBefore: 30,
    headwayAfter: 30,
    status: "reduced",
  },
];

const BEAT_COUNT = 6;
const BEAT_LABELS = ["Before + COVID", "The cuts", "The math", "Two neighborhoods", "Two people", "Equity"];

function formatRiders(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BeatLabel({ n, label }) {
  return (
    <p className={`${styles.beatLabel} type-h4-mono-allcaps`}>
      {String(n).padStart(2, "0")} — {label}
    </p>
  );
}

function StatCounter({ value, label }) {
  return (
    <div className={styles.counterItem}>
      <span className={`${styles.counterValue} type-h1-serif text-ink-default`}>{value}</span>
      <span className={`${styles.counterLabel} type-h4-mono-allcaps text-ink-default`}>{label}</span>
    </div>
  );
}

/** Beat 3: Route chip list. */
function RouteChipList({ routes, reduced = false }) {
  return (
    <ul className={styles.routeChipList}>
      {routes.map((r) => (
        <li
          key={typeof r === "string" ? r : r.code}
          className={`${styles.routeChip} ${reduced ? styles.routeChipReduced : ""} type-h4-mono-allcaps`}
        >
          {typeof r === "string" ? r : r.code}
          {typeof r === "object" && r.note ? (
            <span className={styles.routeChipNote}>{r.note}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Beat 4: two-column comparison cards with layer-2 reveal. */
function ComparisonCards({ layer2Visible }) {
  return (
    <div className={styles.comparisonGrid}>
      {COMPARISON_CARDS.map((card) => (
        <div key={card.hood} className={styles.comparisonCard} style={{ borderTop: `3px solid ${card.accentColor}` }}>
          <h3 className={`${styles.comparisonCardHoodTitle} type-h2-serif text-ink-default`}>{card.hood}</h3>
          <div className={styles.comparisonVisBlock}>
            <CommuteMethodGauge
              workFromHomeShare={card.workFromHomeShare}
              vehicleWalkShare={card.vehicleWalkShare}
              transitShare={card.transitShare}
              hideHeadlineValue={false}
            />
            <PovertyPictogram
              belowPovertyLineShare={card.povertyShare}
              deepPovertyShare={card.deepPovertyShare}
              highIncomeHouseholdShare={card.highIncomeHouseholdShare}
              peoplePerDot={Math.max(1, Math.round(card.totalPop / 50))}
              hideHeadlineValue={false}
            />
          </div>
          {card.layer2.map((s) => (
            <div
              key={s.label}
              className={[
                styles.comparisonStat,
                styles.comparisonStatLayer2,
                layer2Visible ? styles.comparisonStatLayer2Visible : "",
              ].filter(Boolean).join(" ")}
            >
              <span className={`${styles.comparisonStatLabel} type-body`}>{s.label}</span>
              <span className={[styles.comparisonStatValue, s.highlight ? styles.comparisonStatValueHighlight : ""].filter(Boolean).join(" ")}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Beat 5: SVG schematic showing Larimer and Highland Park equidistant from Downtown. */
function NeighborhoodSchematic() {
  return (
    <div className={styles.schematicWrap}>
      <p className={`${styles.schematicLabel} type-h4-mono-allcaps`}>
        Distance from Downtown — schematic (not to scale)
      </p>
      <svg
        className={styles.schematic}
        viewBox="0 0 600 200"
        aria-label="Schematic showing Larimer and Highland Park equidistant from Downtown Pittsburgh"
        role="img"
      >
        {/* Downtown hub */}
        <circle cx={300} cy={100} r={24} fill="var(--b9)" />
        <text x={300} y={105} textAnchor="middle" fill="var(--b1)" fontSize="11" fontFamily="var(--font-sans)" fontWeight="600">DT</text>
        <text x={300} y={145} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="10" fontFamily="var(--font-sans)">Downtown</text>

        {/* Larimer — left, thinned connections */}
        {/* Route 74 — dashed (reduced) */}
        <line x1={276} y1={100} x2={130} y2={100} stroke="var(--r2)" strokeWidth="1.5" strokeDasharray="5 3" />
        {/* Route 86 — dashed (reduced) */}
        <line x1={276} y1={104} x2={130} y2={116} stroke="var(--b7)" strokeWidth="1.5" strokeDasharray="5 3" />
        {/* P10, P17 — very faint (eliminated) */}
        <line x1={276} y1={96} x2={130} y2={84} stroke="var(--n3)" strokeWidth="1" strokeDasharray="2 4" />
        <circle cx={110} cy={100} r={18} fill="var(--r1)" stroke="var(--r2)" strokeWidth="1.5" />
        <text x={110} y={105} textAnchor="middle" fill="var(--r3)" fontSize="9" fontFamily="var(--font-sans)" fontWeight="600">LRM</text>
        <text x={110} y={133} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="10" fontFamily="var(--font-sans)">Larimer</text>
        <text x={110} y={147} textAnchor="middle" fill="var(--r2)" fontSize="8" fontFamily="var(--font-mono)">P10, P17 cut</text>
        <text x={110} y={159} textAnchor="middle" fill="var(--r2)" fontSize="8" fontFamily="var(--font-mono)">74, 86 reduced</text>

        {/* Highland Park — right, solid daytime connection */}
        <line x1={324} y1={100} x2={470} y2={100} stroke="var(--b5)" strokeWidth="2" />
        {/* Second route — lighter */}
        <line x1={324} y1={104} x2={470} y2={112} stroke="var(--b7)" strokeWidth="1.5" />
        <circle cx={490} cy={100} r={18} fill="var(--b2)" stroke="var(--b5)" strokeWidth="1.5" />
        <text x={490} y={105} textAnchor="middle" fill="var(--b8)" fontSize="9" fontFamily="var(--font-sans)" fontWeight="600">HLP</text>
        <text x={490} y={133} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="10" fontFamily="var(--font-sans)">Highland Park</text>
        <text x={490} y={147} textAnchor="middle" fill="var(--b7)" fontSize="8" fontFamily="var(--font-mono)">71B reduced</text>
        <text x={490} y={159} textAnchor="middle" fill="var(--b7)" fontSize="8" fontFamily="var(--font-mono)">(no service 11pm+)</text>

        {/* Distance labels */}
        <text x={205} y={88} textAnchor="middle" fill="var(--color-subtle)" fontSize="9" fontFamily="var(--font-mono)">~3.5 mi</text>
        <text x={395} y={88} textAnchor="middle" fill="var(--color-subtle)" fontSize="9" fontFamily="var(--font-mono)">~3.5 mi</text>

        {/* Legend */}
        <line x1={20} y1={180} x2={40} y2={180} stroke="var(--b5)" strokeWidth="2" />
        <text x={45} y={183} fill="var(--color-subtle)" fontSize="8" fontFamily="var(--font-mono)">daytime retained</text>
        <line x1={160} y1={180} x2={180} y2={180} stroke="var(--r2)" strokeWidth="1.5" strokeDasharray="5 3" />
        <text x={185} y={183} fill="var(--color-subtle)" fontSize="8" fontFamily="var(--font-mono)">reduced (dashed)</text>
        <line x1={310} y1={180} x2={330} y2={180} stroke="var(--n3)" strokeWidth="1" strokeDasharray="2 4" />
        <text x={335} y={183} fill="var(--color-subtle)" fontSize="8" fontFamily="var(--font-mono)">eliminated</text>
      </svg>
    </div>
  );
}

function AQuotes() {
  return (
    <div className={styles.aQuotesGrid}>
      <div className={`${styles.aQuoteCard} ${styles.aQuoteChoice}`}>
        <p className={`${styles.aQuoteTag} type-h4-mono-allcaps`}>Transit choice rider</p>
        <h3 className={`${styles.aQuoteName} type-h2-sans text-ink-default`}>Karl Cureton</h3>
        <p className={`${styles.aQuoteMeta} type-h4-mono-allcaps text-ink-default`}>
          Owns a car · buses for convenience
        </p>
        <p className={`${styles.aQuoteText} type-body`}>
          "I would have to drive to work, pay to park..." losing his bus would be an inconvenience he
          could get used to.
        </p>
      </div>

      <div className={`${styles.aQuoteCard} ${styles.aQuoteNeed}`}>
        <p className={`${styles.aQuoteTag} type-h4-mono-allcaps`}>Transit need rider</p>
        <h3 className={`${styles.aQuoteName} type-h2-sans text-ink-default`}>Kong Lee</h3>
        <p className={`${styles.aQuoteMeta} type-h4-mono-allcaps text-ink-default`}>
          Blind rider · Route 14 · bus-dependent caregiver trips
        </p>
        <p className={`${styles.aQuoteText} type-body`}>
          "Maybe PRT can pay for my Uber rides, what do you think?" She jokes, but this is her
          reality. She takes Route 14 several times a week to pick up her daughter from a half-day
          kindergarten program, and Route 14 is one of 41 lines on the FY26 chopping block.
        </p>
      </div>
    </div>
  );
}

/** Beat 6: two frequency animations side by side.
 *  Larimer — Route 74 reduced major (headway doubles).
 *  Highland Park — Route 71B reduced minor (daytime mostly preserved; note in label).
 */
function FrequencyComparison() {
  return (
    <div className={styles.frequencyGrid}>
      <div className={styles.frequencyPanel}>
        <p className={`${styles.frequencyPanelLabel} type-h4-mono-allcaps`}>
          Larimer — Route 74 (major reduction)
        </p>
        <div className={styles.frequencyPanelBody}>
          <article className={`${styles.frequencyPersonaCard} ${styles.frequencyPersonaNeed}`}>
            <span className={`${styles.frequencyStopIcon} type-h4-mono-allcaps`} style={{ background: LARIMER_ROUTES[0].color }}>
              {LARIMER_ROUTES[0].label}
            </span>
            <h3 className={`${styles.frequencyPersonaName} type-h2-sans text-ink-default`}>Denise</h3>
            <p className={`${styles.frequencyPersonaMeta} type-h4-mono-allcaps text-ink-default`}>
              Larimer · Stop E70267
            </p>
            <p className={`${styles.frequencyPersonaQuote} type-body`}>
              "Denise leaves for work at 6:45am. She takes Route 74 from Larimer Ave to reach her job in Oakland by 7:30. Missing one means missing her shift."
            </p>
          </article>
          <BusRouteComparison
            stop={LARIMER_STOP}
            routes={[LARIMER_ROUTES[0]]}
            selectedArea="downtown"
            showLabels
          />
        </div>
      </div>
      <div className={styles.frequencyPanel}>
        <p className={`${styles.frequencyPanelLabel} type-h4-mono-allcaps`}>
          Highland Park — Route 71B (minor reduction)
        </p>
        <div className={styles.frequencyPanelBody}>
          <article className={`${styles.frequencyPersonaCard} ${styles.frequencyPersonaChoice}`}>
            <span className={`${styles.frequencyStopIcon} type-h4-mono-allcaps`} style={{ background: HIGHLAND_ROUTES[0].color }}>
              {HIGHLAND_ROUTES[0].label}
            </span>
            <h3 className={`${styles.frequencyPersonaName} type-h2-sans text-ink-default`}>Marcus</h3>
            <p className={`${styles.frequencyPersonaMeta} type-h4-mono-allcaps text-ink-default`}>
              Highland Park · Stop E29055
            </p>
            <p className={`${styles.frequencyPersonaQuote} type-body`}>
              "Marcus works downtown. He drives most days, but takes the 71B a few times a week. It's inconvenient. He adjusts."
            </p>
          </article>
          <BusRouteComparison
            stop={HIGHLAND_STOP}
            routes={HIGHLAND_ROUTES}
            selectedArea="downtown"
            showLabels
          />
        </div>
      </div>
    </div>
  );
}

function BeatScrollCue({ onClick }) {
  return (
    <div className={styles.scrollCue}>
      <button
        type="button"
        onClick={onClick}
        className={`${styles.scrollCueButton} type-h4-mono-allcaps text-ink-default`}
        aria-label="Scroll to next section"
      >
        more
        <span aria-hidden className={styles.scrollCueArrow}>
          ↓
        </span>
      </button>
    </div>
  );
}

/** Fixed right-rail progress nav. */
function ProgressNav({ activeBeat, onNav }) {
  return (
    <nav className={styles.progressNav} aria-label="Story progress">
      {BEAT_LABELS.map((label, i) => (
        <button
          key={label}
          type="button"
          className={[styles.progressDot, i === activeBeat ? styles.progressDotActive : ""].join(" ")}
          aria-label={`Beat ${i + 1}: ${label}`}
          aria-current={i === activeBeat ? "step" : undefined}
          onClick={() => onNav(i)}
        />
      ))}
    </nav>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuidedStory() {
  const storyRef = useRef(null);
  const [storyCoverageMode, setStoryCoverageMode] = useState("before");
  const [covidTierData, setCovidTierData] = useState(null);

  // One ref per beat — declared individually to satisfy rules-of-hooks.
  const b0 = useRef(null);
  const b1 = useRef(null);
  const b2 = useRef(null);
  const b3 = useRef(null);
  const b4 = useRef(null);
  const b5 = useRef(null);
  const beatRefs = [b0, b1, b2, b3, b4, b5];

  const { activeBeat } = useScrollBeat(storyRef);

  // Layer-2 stats animate in when "The math" is reached.
  const layer2Visible = activeBeat >= 2;

  // Beat 3 story map pulses between before/after every 2 seconds.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setStoryCoverageMode((prev) => (prev === "before" ? "after" : "before"));
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRidershipTotalsByPovertyTier()
      .then((d) => {
        if (!cancelled) setCovidTierData(d);
      })
      .catch(() => {
        if (!cancelled) setCovidTierData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function scrollToBeat(i) {
    beatRefs[i]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const highTier = covidTierData?.high;
  const lowTier = covidTierData?.low;
  const highDecline =
    highTier?.recoveryPct != null && Number.isFinite(highTier.recoveryPct)
      ? `${highTier.recoveryPct >= 0 ? "+" : ""}${highTier.recoveryPct.toFixed(1)}%`
      : "—";
  const lowDecline =
    lowTier?.recoveryPct != null && Number.isFinite(lowTier.recoveryPct)
      ? `${lowTier.recoveryPct >= 0 ? "+" : ""}${lowTier.recoveryPct.toFixed(1)}%`
      : "—";

  return (
    <>
      <ProgressNav activeBeat={activeBeat} onNav={scrollToBeat} />

      <article ref={storyRef} className={styles.story}>

        {/* ── Beat 1: Before + COVID ────────────────────────────────── */}
        <section
          ref={b0}
          data-story-beat
          className={`${styles.beatStickyVis} ${styles.beatHalfSplit}`}
          aria-labelledby="beat-1-h"
        >
          <div className={styles.beatCopy}>
            <BeatLabel n={1} label="Before + COVID" />
            <h2 id="beat-1-h" className={`${styles.lede} type-h1-serif text-ink-default`}>
              Before the pandemic, 200,000 people rode Pittsburgh's buses every weekday. Recovery came
              back unevenly.
            </h2>
            <p className={`${styles.body} type-body`}>
              If we split riders by neighborhood poverty levels, we see that riders in 20%+ poverty
              neighborhoods recovered more than riders in lower-poverty areas, where white-collar
              work-from-home patterns likely reduced commute demand.{" "}
              {highTier && lowTier
                ? `In 2018, that was ${formatRiders(highTier.baselineSum)} riders in 20%+ poverty areas and ${formatRiders(lowTier.baselineSum)} riders in less than 20% poverty areas.`
                : ""}
            </p>
            <div className={styles.covidStatGrid} aria-label="Ridership decline summary by poverty tier">
              <article className={styles.covidStatModule}>
                <p className={`${styles.covidStatValue} type-h2-sans`}>{highDecline}</p>
                <p className={`${styles.covidStatLabel} type-h4-mono-allcaps`}>
                  high-poverty ridership decline post-COVID
                </p>
              </article>
              <article className={styles.covidStatModule}>
                <p className={`${styles.covidStatValue} type-h2-sans`}>{lowDecline}</p>
                <p className={`${styles.covidStatLabel} type-h4-mono-allcaps`}>
                  less than 20% poverty ridership decline post-COVID
                </p>
              </article>
            </div>
          </div>
          <div className={styles.beatStickyVisPanel}>
            <CovidRecoveryDotsComparison />
          </div>
          <BeatScrollCue onClick={() => scrollToBeat(1)} />
        </section>

        {/* ── Beat 2: The cuts ──────────────────────────────────────── */}
        <section
          ref={b1}
          data-story-beat
          className={styles.beat}
          aria-labelledby="beat-2-h"
        >
          <div className={styles.copyBlock}>
            <BeatLabel n={2} label="The cuts" />
            <h2 id="beat-2-h" className={`${styles.lede} type-h1-serif text-ink-default`}>
              Facing a budget issues, PRT scored every route by ridership efficiency and planned a sweeping FY26 PRT plan, reducing 57 routes and eliminating 41 routes entirely.
            </h2>

            <div className={styles.counterRow}>
              <StatCounter value={FY26_ROUTES_ELIMINATED} label="Routes eliminated" />
              <StatCounter value={FY26_ROUTES_REDUCED} label="Routes reduced" />
              <StatCounter value={FY26_STOPS_LOST} label="Stops orphaned (est.)" />
            </div>

          </div>
          <div className={styles.cutsMapWrap}>
            <NeighborhoodPanelProvider>
              <CoverageMap mode="story" storyViewMode={storyCoverageMode} />
            </NeighborhoodPanelProvider>
          </div>
          <BeatScrollCue onClick={() => scrollToBeat(2)} />
        </section>

        {/* ── Beat 3: The problem with the math ────────────────────── */}
        <section ref={b2} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-3-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={3} label="The problem with the math" />
            <h2 id="beat-3-h" className={`${styles.lede} type-h1-serif text-ink-default`}>
              But efficiency scores only count riders, not transit dependence and the ability to recover from a cut.
            </h2>

          </div>
          <AQuotes />
          <BeatScrollCue onClick={() => scrollToBeat(3)} />
        </section>

        {/* ── Beat 4: Two neighborhoods, up close ──────────────────── */}
        <section ref={b3} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-4-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={4} label="Two neighborhoods, up close" />
            <h2 id="beat-4-h" className={`${styles.lede} type-h1-serif text-ink-default`}>
              Larimer and Highland Park, neighborhoods two miles apart. Both are losing service, but with very differnt demographics, needs and
              consequences.
            </h2>
            <p className={`${styles.body} type-body`}>
              Larimer loses two routes entirely (P10, P17) and sees major frequency cuts on Route
              74 and minor cuts on Route 86. Highland Park loses its named route (71B) to 11pm
              service cuts, with daytime frequency mostly preserved.
            </p>
            <p className={`${styles.body} type-body`}>
              Both neighborhoods. Both losing service. The difference is what losing service means.
            </p>
          </div>
          <ComparisonCards layer2Visible={layer2Visible} />
          <BeatScrollCue onClick={() => scrollToBeat(4)} />
        </section>

        {/* ── Beat 5: Two people, one stop ──────────────────────────── */}
        <section ref={b4} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-5-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={5} label="Two people, one stop" />
            <h2 id="beat-5-h" className={`${styles.lede} type-h1-serif text-ink-default`}>
              Both neighborhoods are losing service, but with very different consequences for the humans who use them.
            </h2>
            <p className={`${styles.body} type-body`}>
              Larimer: daytime gap doubles — from ~20 to ~40 min between buses. Highland Park:
              daytime frequency mostly preserved — main cut is no service after 11pm.
            </p>
          </div>
          <FrequencyComparison />
          <BeatScrollCue onClick={() => scrollToBeat(5)} />
        </section>

        {/* ── Beat 6: The equity argument ───────────────────────────── */}
        <section ref={b5} data-story-beat className={styles.closingBeat} aria-labelledby="beat-6-h">
          <BeatLabel n={6} label="The equity argument" />
          <h2 id="beat-6-h" className={`${styles.closingLede} type-h1-serif text-ink-default`}>
            Efficiency and equity aren't always in conflict. But when they are, the decision of which to prioritize should be grounded in differing human-level needs, not just numbers. 
            one.
          </h2>
          <p className={`${styles.body} type-body`}>
                Go to explore mode to see the people behind each neighborhood.
          </p>
        </section>

      </article>
    </>
  );
}
