"use client";

import { useRef } from "react";
import Link from "next/link";
import { NeighborhoodPanelProvider } from "../../contexts/NeighborhoodPanelContext";
import CoverageMap from "../coverage-map/CoverageMap";
import CovidRecoveryDotsComparison from "../covid-recovery/CovidVis";
import BusRouteComparison from "../bus-route-comparison/BusRouteComparison";
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
    subtitle: "74 reduced (major) · 86 reduced (minor) · P10, P17 eliminated",
    accentColor: "var(--r2)",
    layer1: [
      // CSV: share_below_100pct_poverty_threshold = 0.327993898
      { label: "Poverty rate", value: "32.8%", highlight: true },
      // CSV: share_commute_public_transit = 0.220588235
      { label: "Transit commute share", value: "22.1%", highlight: true },
      // CSV: total_pop = 1473
      { label: "Population", value: "1,473", highlight: false },
      // CSV: weekday_avg_riders_baseline / recent for route 74
      { label: "Rt. 74 daily riders (baseline → recent)", value: "976 → 677", highlight: false },
    ],
    layer2: [
      { label: "Transit dependence", value: "High — no car alternative", highlight: true },
      { label: "P10 / P17", value: "Eliminated", highlight: true },
      { label: "Impact", value: "Fewer buses on only remaining routes", highlight: true },
    ],
  },
  {
    hood: "Highland Park",
    subtitle: "71B reduced (minor, 11pm cutoff) · 71A reduced · 93 reduced",
    accentColor: "var(--b5)",
    layer1: [
      // CSV: share_below_100pct_poverty_threshold = 0.071489002
      { label: "Poverty rate", value: "7.1%", highlight: false },
      // CSV: share_commute_public_transit = 0.1
      { label: "Transit commute share", value: "10%", highlight: false },
      // CSV: total_pop = 2364
      { label: "Population", value: "2,364", highlight: false },
      // CSV: weekday_avg_riders_baseline / recent for route 71B
      { label: "Rt. 71B daily riders (baseline → recent)", value: "5,020 → 3,958", highlight: false },
    ],
    layer2: [
      { label: "Transit dependence", value: "Low — cars available", highlight: false },
      { label: "71B daytime service", value: "Mostly preserved", highlight: false },
      { label: "Impact", value: "Late-night service lost; can adjust", highlight: false },
    ],
  },
];

// ─── Beat 5 neighborhood cards ────────────────────────────────────────────────
const HOOD_CARDS = [
  {
    name: "Larimer",
    subtitle: "Pittsburgh's highest-poverty neighborhood",
    accent: "var(--r2)",
    stats: [
      // CSV: share_below_100pct_poverty_threshold
      { label: "Poverty rate (100% threshold)", value: "32.8%" },
      // CSV: total_pop
      { label: "Population", value: "1,473" },
      // CSV: share_commute_public_transit
      { label: "Transit commute share", value: "22.1%" },
      // CSV: share_commute_car_truck_van
      { label: "Car commute share", value: "53.1%" },
      { label: "Routes before FY26", value: "74, 86, P10, P17" },
      { label: "Routes after FY26", value: "74 ↓ (major), 86 ↓ (minor)" },
    ],
  },
  {
    name: "Highland Park",
    subtitle: "Low-poverty, transit-optional neighborhood",
    accent: "var(--b5)",
    stats: [
      { label: "Poverty rate (100% threshold)", value: "7.1%" },
      { label: "Population", value: "2,364" },
      { label: "Transit commute share", value: "10%" },
      { label: "Car commute share", value: "50.9%" },
      { label: "Routes before FY26", value: "71B, 71A, 93" },
      { label: "Routes after FY26", value: "71B ↓ (minor, no 11pm+), 71A ↓, 93 ↓" },
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

const BEAT_COUNT = 7;
const BEAT_LABELS = ["Before", "COVID", "The cuts", "The math", "Two neighborhoods", "Two people", "Equity"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function BeatLabel({ n, label }) {
  return (
    <p className={`${styles.beatLabel} type-story-beat-label`}>
      {String(n).padStart(2, "0")} — {label}
    </p>
  );
}

function StatCounter({ value, label }) {
  return (
    <div className={styles.counterItem}>
      <span className={styles.counterValue}>{value}</span>
      <span className={`${styles.counterLabel} type-data-label text-ink-subtle`}>{label}</span>
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
          className={`${styles.routeChip} ${reduced ? styles.routeChipReduced : ""} type-data-route-label`}
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
          <p className={`${styles.comparisonCardLabel} type-story-beat-label`}>{card.hood}</p>
          <p className={`type-body-sm text-ink-secondary`} style={{ margin: "0 0 1rem" }}>{card.subtitle}</p>
          {card.layer1.map((s) => (
            <div key={s.label} className={styles.comparisonStat}>
              <span className={`${styles.comparisonStatLabel} type-body-sm`}>{s.label}</span>
              <span className={[styles.comparisonStatValue, s.highlight ? styles.comparisonStatValueHighlight : ""].filter(Boolean).join(" ")}>
                {s.value}
              </span>
            </div>
          ))}
          {card.layer2.map((s) => (
            <div
              key={s.label}
              className={[
                styles.comparisonStat,
                styles.comparisonStatLayer2,
                layer2Visible ? styles.comparisonStatLayer2Visible : "",
              ].filter(Boolean).join(" ")}
            >
              <span className={`${styles.comparisonStatLabel} type-body-sm`}>{s.label}</span>
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
      <p className={`${styles.schematicLabel} type-story-beat-label`}>
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

/** Beat 5: side-by-side neighborhood fact cards. */
function NeighborhoodCards() {
  return (
    <div className={styles.hoodGrid}>
      {HOOD_CARDS.map((hood) => (
        <div key={hood.name} className={styles.hoodCard} style={{ borderTop: `3px solid ${hood.accent}` }}>
          <h3 className={`${styles.hoodCardName} type-h3 text-ink-default`}>{hood.name}</h3>
          <p className={`${styles.hoodCardSubtitle} type-body-sm`}>{hood.subtitle}</p>
          {hood.stats.map((s) => (
            <div key={s.label} className={styles.hoodStat}>
              <span className={`${styles.hoodStatLabel} type-body-sm`}>{s.label}</span>
              <span className={`${styles.hoodStatValue} type-data-value`}>{s.value}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Beat 6: persona cards shown side-by-side. */
function PersonaCards() {
  return (
    <div className={styles.personaGrid}>
      {/* Persona A — Larimer, Route 74 */}
      {/* NOTE: Route 74 is reduced (major) in CSV, NOT eliminated.
          Persona copy reflects major frequency cuts, not route elimination. */}
      <div className={`${styles.personaCard} ${styles.personaCardLarimer}`}>
        <h3 className={`${styles.personaName} type-h3 text-ink-default`}>Diane</h3>
        <p className={`${styles.personaNeighborhood} type-data-label text-ink-subtle`}>
          Larimer · Route 74 · Stop E70267
        </p>
        <p className={`${styles.personaQuote} type-story-body`}>
          "Diane leaves for work at 6:45am. She takes the Route 74 from Larimer Ave to reach her
          hospital job in Oakland by 7:30. After the FY26 frequency cuts to Route 74, buses come
          significantly less often. Missing one means missing her shift. She has no car. There is
          no backup plan."
        </p>
        <p className={`${styles.personaDisclaimer} type-data-label`}>
          Composite persona — not a real individual. Route 74 data: 976 → 677 daily riders
          (CSV). FY26 status: reduced, major tier.
        </p>
      </div>

      {/* Persona B — Highland Park, Route 71B */}
      {/* Route 71B is reduced (minor) in CSV. Primary cut = no service after 11pm.
          Stop E29055 verified in route_stop_per_route.csv. */}
      <div className={`${styles.personaCard} ${styles.personaCardHighlandPark}`}>
        <h3 className={`${styles.personaName} type-h3 text-ink-default`}>Marcus</h3>
        <p className={`${styles.personaNeighborhood} type-data-label text-ink-subtle`}>
          Highland Park · Route 71B · Stop E29055
        </p>
        <p className={`${styles.personaQuote} type-story-body`}>
          "Marcus works downtown. He drives most days, but takes the 71B a few times a week.
          After the FY26 cuts, the 71B ends at 11pm. He occasionally has to drive home from late
          events instead of taking the bus. It's inconvenient. He adjusts."
        </p>
        <p className={`${styles.personaDisclaimer} type-data-label`}>
          Composite persona — not a real individual. Route 71B data: 5,020 → 3,958 daily
          riders (CSV). FY26 status: reduced, minor tier. Named route for Highland Park.
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
        <p className={`${styles.frequencyPanelLabel} type-story-beat-label`}>
          Larimer — Route 74 (major reduction)
        </p>
        <p className={`type-data-label text-ink-subtle`} style={{ margin: "0 0 0.5rem" }}>
          Daytime gap doubles — from ~20 to ~40 min between buses
        </p>
        <BusRouteComparison
          stop={LARIMER_STOP}
          routes={[LARIMER_ROUTES[0]]}
          selectedArea="downtown"
          showLabels
        />
      </div>
      <div className={styles.frequencyPanel}>
        <p className={`${styles.frequencyPanelLabel} type-story-beat-label`}>
          Highland Park — Route 71B (minor reduction)
        </p>
        <p className={`type-data-label text-ink-subtle`} style={{ margin: "0 0 0.5rem" }}>
          Daytime frequency mostly preserved — main cut is no service after 11pm
        </p>
        <BusRouteComparison
          stop={HIGHLAND_STOP}
          routes={HIGHLAND_ROUTES}
          selectedArea="shadyside"
          showLabels
        />
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
        className={`${styles.scrollCueButton} type-data-label text-ink-subtle`}
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

  // One ref per beat — declared individually to satisfy rules-of-hooks.
  const b0 = useRef(null);
  const b1 = useRef(null);
  const b2 = useRef(null);
  const b3 = useRef(null);
  const b4 = useRef(null);
  const b5 = useRef(null);
  const b6 = useRef(null);
  const beatRefs = [b0, b1, b2, b3, b4, b5, b6];

  const { activeBeat } = useScrollBeat(storyRef);

  // Layer-2 stats animate in when Beat 4 is reached.
  const layer2Visible = activeBeat >= 3;

  // CoverageMap transitions from "before" (beat 0) to "after" (beat 2+).
  const coverageViewMode = activeBeat >= 2 ? "after" : "before";

  function scrollToBeat(i) {
    beatRefs[i]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <ProgressNav activeBeat={activeBeat} onNav={scrollToBeat} />

      <article ref={storyRef} className={styles.story}>

        {/* ── Beat 1: The system before ─────────────────────────────── */}
        <section ref={b0} data-story-beat className={styles.beat} aria-labelledby="beat-1-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={1} label="The system before" />
            <h2 id="beat-1-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Before the pandemic, 200,000 people rode Pittsburgh's buses every weekday.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              Pittsburgh's Port Authority network reached virtually every neighborhood in the city.
              Coverage was imperfect but remarkably broad — a baseline most residents took for
              granted.
            </p>
          </div>
          {/* <NeighborhoodPanelProvider>
            <CoverageMap mode="story" storyViewMode="before" />
          </NeighborhoodPanelProvider> */}
          <BeatScrollCue onClick={() => scrollToBeat(1)} />
        </section>

        {/* ── Beat 2: COVID recovery ────────────────────────────────── */}
        <section ref={b1} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-2-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={2} label="COVID recovery" />
            <h2 id="beat-2-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Ridership collapsed — then came back unevenly.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              In wealthier neighborhoods, people chose other options. In Larimer, Homewood, and
              Knoxville, the bus snapped back almost immediately. It was never optional.
            </p>
            <p className={`${styles.body} type-story-body`}>
              This is the structural reframe:{" "}
              <strong>low ridership does not mean low need.</strong> Routes serving high-poverty
              corridors maintained more of their pre-pandemic ridership than routes in wealthier
              areas — because riders had no alternative.
            </p>
          </div>
          <div className={styles.visWrap}>
            <CovidRecoveryDotsComparison />
          </div>
          <BeatScrollCue onClick={() => scrollToBeat(2)} />
        </section>

        {/* ── Beat 3: The cuts ──────────────────────────────────────── */}
        <section ref={b2} data-story-beat className={styles.beat} aria-labelledby="beat-3-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={3} label="The cuts" />
            <h2 id="beat-3-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Facing a budget shortfall, PRT scored every route by ridership efficiency.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              The FY26 plan eliminates {FY26_ROUTES_ELIMINATED} routes entirely and reduces service
              on {FY26_ROUTES_REDUCED} others —{" "}
              {FY26_ROUTES_ELIMINATED + FY26_ROUTES_REDUCED} of 100 routes affected.
            </p>

            <div className={styles.counterRow}>
              <StatCounter value={FY26_ROUTES_ELIMINATED} label="Routes eliminated" />
              <StatCounter value={FY26_ROUTES_REDUCED} label="Routes reduced" />
              <StatCounter value={FY26_STOPS_LOST} label="Stops orphaned (est.)" />
            </div>

            <div className={styles.routeCallout}>
              <p className={`${styles.routeCalloutTitle} type-data-label`}>
                Eliminated — key routes (all confirmed in route_status_official.csv)
              </p>
              <RouteChipList routes={ELIMINATED_HIGHLIGHTS} />
              <p className={`${styles.routeCalloutTitle} type-data-label`} style={{ marginTop: "1rem" }}>
                Reduced — Penn Ave corridor + east end neighborhoods
              </p>
              <RouteChipList routes={REDUCED_HIGHLIGHTS} reduced />
            </div>
          </div>
          {/* <NeighborhoodPanelProvider>
            <CoverageMap mode="story" storyViewMode={coverageViewMode} />
          </NeighborhoodPanelProvider> */}
          <BeatScrollCue onClick={() => scrollToBeat(3)} />
        </section>

        {/* ── Beat 4: The problem with the math ────────────────────── */}
        <section ref={b3} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-4-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={4} label="The problem with the math" />
            <h2 id="beat-4-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Efficiency scores count passengers — not dependence.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              A route serving 300 riders in Highland Park and a route serving 300 riders in
              Larimer score identically. The contexts could not be more different.
            </p>
            <p className={`${styles.body} type-story-body`}>
              Scroll to reveal what ridership counts erase.
            </p>
          </div>
          <ComparisonCards layer2Visible={layer2Visible} />
          <BeatScrollCue onClick={() => scrollToBeat(4)} />
        </section>

        {/* ── Beat 5: Two neighborhoods, up close ──────────────────── */}
        <section ref={b4} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-5-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={5} label="Two neighborhoods, up close" />
            <h2 id="beat-5-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Larimer and Highland Park. Two miles apart. Both losing service. Different
              consequences.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              Larimer loses two routes entirely (P10, P17) and sees major frequency cuts on Route
              74 and minor cuts on Route 86. Highland Park loses its named route (71B) to 11pm
              service cuts, with daytime frequency mostly preserved.
            </p>
            <p className={`${styles.body} type-story-body`}>
              Both neighborhoods. Both losing service. The difference is what losing service means.
            </p>
          </div>
          <NeighborhoodSchematic />
          <NeighborhoodCards />
          <BeatScrollCue onClick={() => scrollToBeat(5)} />
        </section>

        {/* ── Beat 6: Two people, one stop ──────────────────────────── */}
        <section ref={b5} data-story-beat className={styles.centeredBeat} aria-labelledby="beat-6-h">
          <div className={styles.copyBlock}>
            <BeatLabel n={6} label="Two people, one stop" />
            <h2 id="beat-6-h" className={`${styles.lede} type-story-lede text-ink-default`}>
              Same city. Same efficiency score. Different lives.
            </h2>
            <p className={`${styles.body} type-story-body`}>
              The animation shows bus arrival frequency at each person's primary stop — before and
              after FY26 cuts. Wider spacing between dots means longer waits. Larimer's loss is a
              working-hours problem. Highland Park's loss is a late-night inconvenience.
            </p>
          </div>
          <PersonaCards />
          <FrequencyComparison />
          <BeatScrollCue onClick={() => scrollToBeat(6)} />
        </section>

        {/* ── Beat 7: The equity argument ───────────────────────────── */}
        <section ref={b6} data-story-beat className={styles.closingBeat} aria-labelledby="beat-7-h">
          <BeatLabel n={7} label="The equity argument" />
          <h2 id="beat-7-h" className={`${styles.closingLede} type-story-lede text-ink-default`}>
            Efficiency and equity aren't always in conflict.
          </h2>
          <p className={`${styles.body} type-story-body`}>
            But when they are, choosing which to prioritize is a values decision — not a technical
            one. Pittsburgh's cuts concentrate loss where loss is least recoverable.
          </p>
          <div className={styles.ctaWrap}>
            <Link href="/test" className={`${styles.ctaButton} type-body-m`}>
              Explore the full dashboard →
            </Link>
            <Link href="/" className={`${styles.ctaLink} type-body-sm`}>
              ↑ Back to top
            </Link>
          </div>
        </section>

      </article>
    </>
  );
}
