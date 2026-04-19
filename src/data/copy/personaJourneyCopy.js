/**
 * Persona day card — UI strings, journeys before/after, schedules, stats, consequences (`PersonaDayCard`).
 * Human-readable summary: `docs/PERSONAS.md`.
 * Neighborhood context: `data/fy26_route_n_profiles_all.csv` (Stanton Heights, Lincoln-Lemington-Belmar).
 *
 * ## Pairing rationale (data-driven, Apr 2026 review)
 *
 * LLB (4,485 pop, 32.6% poverty, 25.8% transit dep) vs Stanton Heights (4,555 pop, 9.8%
 * poverty, 9.3% transit dep) — 98.5% population match, 3.3× poverty gap, 2.8× transit-
 * dependence gap. No 30%+ poverty neighborhood loses an eliminated *local* bus where stops
 * are orphaned with comparable population to SH. The eliminated routes hitting 30%+ poverty
 * areas are commuter flyers (P10, P17) — a consequence of PRT's efficiency logic targeting
 * low-ridership routes. P10 has a street-level stop in LLB (WASHINGTON BLVD AT HIGHLAND DR,
 * 40.474002 / −79.908205, stop E56360) with *no other route* at that stop pair in
 * `route_stop_per_route.csv`. The flyer classification is PRT's operational label, not the
 * rider's experience: no park-and-ride, no car in the driveway — just a street-level bus stop
 * in a neighborhood where 1 in 3 residents is below poverty.
 *
 * Compound impact on LLB: 7 of 8 routes affected — P10 eliminated, P17 eliminated, plus
 * routes 1, 74, 75, 82, 91 all major reductions. Only route 079 is unaffected.
 * Stanton Heights: 0 of 3 routes eliminated; route 089 explicitly retained for equity;
 * 087 and 091 major reductions.
 *
 * Source: `data/fy26_route_n_profiles_all.csv`, `data/FY26_route_status_all.csv`,
 * `data/route_stop_per_route.csv` (stop E56360 for P10; stop E16270 for nearest 74 fallback).
 */

/**
 * @typedef {'firstMile' | 'transit' | 'uncertain'} JourneyEdgeKind
 * @typedef {{
 *   src?: string;
 *   side?: 'left' | 'right';
 *   opacity?: number;
 * }} JourneyStepImage
 * Omit `src` for grey placeholder blocks; add `src` when swapping in real stop photography.
 * @typedef {{
 *   edgeKind: JourneyEdgeKind;
 *   edgeLabel: string;
 *   minutes: number;
 *   nodeLabel: string;
 *   stepPhoto?: JourneyStepImage;
 *   arrivalPhoto?: JourneyStepImage;
 * }} JourneySegment
 * stepPhoto: thumb beside the leg (time-scaled) row. arrivalPhoto: thumb beside the destination node row.
 *
 * @typedef {{ time: string; label: string }} DayScheduleRow
 * @typedef {{ heading?: string; beforeRows: DayScheduleRow[]; afterRows: DayScheduleRow[] }} DaySchedule
 */

/**
 * Stop coordinates from `data/route_stop_per_route.csv`.
 * Used for distance calculations, map pins, and orphan-stop verification.
 */
export const storyStopCoordinates = {
  p10WashingtonBlvd: {
    stopId: "E56360",
    stopCode: 14577,
    name: "WASHINGTON BLVD AT HIGHLAND DR",
    lat: 40.474002,
    lon: -79.908205,
    routes: ["P10"],
    weekdayTrips: 5,
    saturdayTrips: 0,
    sundayTrips: 0,
    orphanedAfterFY26: true,
    neighborhood: "Lincoln-Lemington-Belmar",
    note: "Only P10 serves this stop; no same-stop substitute after elimination.",
  },
  rt74DeanSt: {
    stopId: "E16270",
    stopCode: 8450,
    name: "DEAN ST AT LARIMER AVE",
    lat: 40.469236,
    lon: -79.905671,
    routes: ["74"],
    neighborhood: "Lincoln-Lemington-Belmar",
    walkFromP10StopMi: 0.34,
    walkFromP10StopMin: 7,
    note: "Nearest Rt 74 stop to orphaned P10 stop; 74 is major-reduced in FY26.",
  },
  rt82LincolnAveRowan: {
    stopId: "E35920",
    stopCode: 8869,
    name: "LINCOLN AVE AT ROWAN ST",
    lat: 40.463924,
    lon: -79.902007,
    routes: ["82", "P17"],
    neighborhood: "Lincoln-Lemington-Belmar",
    walkFromP10StopMi: 0.72,
    walkFromP10StopMin: 14,
    note: "Nearest Rt 82 stop to orphaned P10 stop; P17 also stops here but is eliminated — Rt 82 (major-reduced) is the only remaining route.",
  },
  rt82LincolnAveArbor: {
    stopId: "E35770",
    stopCode: 8866,
    name: "LINCOLN AVE AT ARBOR ST",
    lat: 40.466431,
    lon: -79.89777,
    routes: ["82", "P17"],
    neighborhood: "Lincoln-Lemington-Belmar",
    note: "P17 co-located with Rt 82; P17 elimination orphans zero stops on Lincoln Ave.",
  },
};

/**
 * Neighborhood-level FY26 compound impact, sourced from `fy26_route_n_profiles_all.csv`.
 */
export const neighborhoodFY26Impact = {
  "Lincoln-Lemington-Belmar": {
    population: 4485,
    belowPovertyPct: 0.326,
    transitDependentPct: 0.258,
    routesBefore: ["001", "074", "075", "079", "082", "091", "P10", "P17"],
    routesEliminated: ["P10", "P17"],
    routesMajorReduced: ["001", "074", "075", "082", "091"],
    routesUnaffected: ["079"],
    pctRoutesImpacted: 87.5,
    flyerClassificationNote:
      "P10 and P17 are classified as commuter flyers by PRT. In LLB, both have street-level stops — no park-and-ride infrastructure. The flyer label reflects PRT's operational tier, not the rider profile of a 32.6%-poverty neighborhood. The efficiency logic that eliminates flyers is blind to who boards at these curb stops.",
  },
  "Stanton Heights": {
    population: 4555,
    belowPovertyPct: 0.098,
    transitDependentPct: 0.093,
    routesBefore: ["087", "089", "091"],
    routesEliminated: [],
    routesMajorReduced: ["087", "091"],
    routesUnaffected: ["089"],
    routesRetainedForEquity: ["089"],
    pctRoutesImpacted: 66.7,
    equityRetentionNote:
      "Route 089 (Garfield Commons) was explicitly retained by PRT despite low efficiency, citing equity. Stanton Heights keeps all 3 routes.",
  },
};

export const personaDayCardNarrative = {
  ui: {
    sectionHeading: "Two commuters, one budget crisis",
    sectionHeadingBefore: "Behind every ridership number is a place",
    sectionBeforeDek: "For some riders, PRT isn't a nice-to-have. It's how they get around.",
    sectionHeadingAfter: "",
    sectionAfterDek: "",
    columnAriaLabelA: "Marcus, choice rider, Stanton Heights",
    columnAriaLabelB: "Denise, dependent rider, Lincoln-Lemington–Belmar",
    timelineHeading: "Same morning, same system",
    statsHeading: "At a glance",
    consequencesHeading: "If the cut happens",
    manageableFooterTitle: "Alternatives available",
    criticalFooterTitle: "No viable alternative",
    journeyScaleNote:
      "Each leg's horizontal width is proportional to illustrative minutes (not GTFS-schedule exact), so longer trips and detours span more distance. While the journey strip is pinned, vertical scrolling moves the strip horizontally; walking and uncertain legs use a dashed underline and transit legs are solid. Denise's home, school, work, and doctor labels are a composite scene — confirm walk distances and clock times with a map and PRT FY26 timetables. This repo has no bundled `stop_times.txt`.",
    sharedRouteNote:
      "FY26 pairing: 71B Highland Park (minor reduction; BRT spine) vs P10 Allegheny Valley Flyer at WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W). P10 is PRT's only route at that stop in `route_stop_per_route.csv` — classified as a commuter flyer, but boarded from a street-level curb in a neighborhood where 32.6% live below poverty. No park-and-ride. No car in the driveway. When PRT's efficiency logic eliminates P10, the stop disappears from the map. Nearest fallback: Rt 74 at DEAN ST AT LARIMER AVE (~0.34 mi / 7 min walk), itself major-reduced. LLB compound impact: 7 of 8 routes cut or eliminated; only Rt 079 unaffected.",
    flyerFramingNote:
      "P10 is classified as a commuter flyer — designed for suburban park-and-ride commuters. But in Lincoln-Lemington-Belmar, residents board at a street-level stop on Washington Blvd. The flyer designation is PRT's operational label, not the rider's lived experience. When PRT eliminates P10 for low efficiency, that classification doesn't change what happens at the curb: the stop is orphaned, and the nearest alternative is a longer walk to a route that itself runs less often.",
  },
  personas: {
    a: {
      name: "Marcus",
      tag: "Choice rider",
      neighborhood: "Stanton Heights",
      incomeLabel: "$77,978 median household income (ACS 2023 — confirm)",
      hasCar: true,
      carStatusLabel: "Household has a vehicle",
      startNodeLabel: "Home",
      neighborhoodProfile: {
        population: 4555,
        belowPovertyPct: 9.8,
        transitDependentPct: 9.3,
        routesBeforeCount: 3,
        routesEliminatedCount: 0,
        routeRetainedForEquity: "089",
        source: "fy26_route_n_profiles_all.csv, Stanton Heights row",
      },
      /** @type {JourneySegment[]} */
      journeyBefore: [
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to 71B on Stanton Ave",
          minutes: 6,
          nodeLabel: "71B stop",
          stepPhoto: { side: "right" },
        },
        {
          edgeKind: "transit",
          edgeLabel: "71B Highland Park → Downtown (Penn / Liberty corridor)",
          minutes: 26,
          nodeLabel: "Downtown",
        },
        { edgeKind: "firstMile", edgeLabel: "walk", minutes: 6, nodeLabel: "office" },
      ],
      /** @type {JourneySegment[]} */
      journeyAfter: [
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to 71B (same stop)",
          minutes: 6,
          nodeLabel: "71B stop",
          stepPhoto: { side: "right" },
        },
        {
          edgeKind: "transit",
          edgeLabel: "71B · slightly longer off-peak waits",
          minutes: 32,
          nodeLabel: "Downtown",
        },
        { edgeKind: "firstMile", edgeLabel: "walk", minutes: 6, nodeLabel: "office" },
      ],
      trips: [
        { time: "7:10am", description: "Walks to 71B on Stanton Ave" },
        { time: "7:18am", description: "Boards 71B toward Downtown" },
        { time: "7:50am", description: "Walks from stop to desk" },
      ],
      stats: [
        { value: "38 min", label: "total commute" },
        { value: "~12%", label: "no-car households (illustrative)" },
        { value: "1", label: "core bus leg" },
      ],
      statsAfter: [
        { value: "44 min", label: "total commute" },
        { value: "~20 min", label: "drive if he pivots" },
        { value: "1", label: "core bus leg" },
      ],
      afterCut: {
        type: "manageable",
        items: [
          "Route still operates — minor reduction in off-peak frequency",
          "Drive alternative: ~20 min, $14–18/day parking Downtown",
          "Employer transit benefit covers ConnectCard",
          "71B corridor selected for BRT upgrade; new stations targeted by 2027 (University Line / PRT BRT plan — confirm dates)",
          "Route 089 explicitly retained by PRT for equity — Stanton Heights keeps all 3 routes",
        ],
      },
    },
    b: {
      name: "Denise",
      tag: "Dependent rider",
      neighborhood: "Lincoln-Lemington–Belmar",
      incomeLabel:
        "~33% below poverty; ~26% transit-commute proxy (workers) — Lincoln-Lemington-Belmar row, `fy26_route_n_profiles_all` (2022 ACS fields)",
      hasCar: false,
      carStatusLabel: "No household vehicle",
      startNodeLabel: "Home (illustrative)",
      neighborhoodProfile: {
        population: 4485,
        belowPovertyPct: 32.6,
        transitDependentPct: 25.8,
        routesBeforeCount: 8,
        routesEliminatedCount: 2,
        routesMajorReducedCount: 5,
        pctRoutesImpacted: 87.5,
        source: "fy26_route_n_profiles_all.csv, Lincoln-Lemington-Belmar row",
      },
      stopCoordinates: {
        primary: {
          stopId: "E56360",
          name: "WASHINGTON BLVD AT HIGHLAND DR",
          lat: 40.474002,
          lon: -79.908205,
          routes: ["P10"],
          orphanedAfterFY26: true,
        },
        fallbackRt74: {
          stopId: "E16270",
          name: "DEAN ST AT LARIMER AVE",
          lat: 40.469236,
          lon: -79.905671,
          routes: ["74"],
          walkFromPrimaryMi: 0.34,
          walkFromPrimaryMin: 7,
        },
        fallbackRt82: {
          stopId: "E35920",
          name: "LINCOLN AVE AT ROWAN ST",
          lat: 40.463924,
          lon: -79.902007,
          routes: ["82"],
          walkFromPrimaryMi: 0.72,
          walkFromPrimaryMin: 14,
        },
      },
      /** @type {DaySchedule} */
      daySchedule: {
        heading: "Illustrative anchors & clock",
        beforeRows: [
          { time: "Places", label: "Home: 7426 Washington Pl., Pittsburgh 15206 (composite, unverified)" },
          { time: "", label: "School: Pittsburgh Lincoln K-8 — 328 Lincoln Ave (kid drop-off)" },
          { time: "", label: "Work: Liberty Ave & Smithfield St — shift job, Central Business District" },
          {
            time: "",
            label:
              "Doctor (quarterly): primary care — UPMC Shadyside Family Health Center, Centre Ave & Somerset Pl. (before cuts: P10 → busway/Fifth, illustrative)",
          },
          { time: "6:15a", label: "Leave home — walk with child toward Lincoln Ave" },
          { time: "6:29a", label: "Lincoln K-8 drop-off" },
          { time: "6:35a", label: "Walk to WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W — stop E56360; P10 only at this stop)" },
          { time: "6:41a", label: "Board P10 Allegheny Valley Flyer inbound — classified as a commuter flyer, but boarded from a street-level curb in a 32.6%-poverty neighborhood (Fifth Ave / East Busway pattern — illustrative)" },
          { time: "7:07a", label: "Alight FIFTH AVE AT HAMILTON AVE — walk to Liberty & Smithfield" },
          { time: "7:30a", label: "Clock-in" },
        ],
        afterRows: [
          { time: "Places", label: "Same home, school, work & doctor as before — commute path changes" },
          { time: "6:15a", label: "Leave home; Lincoln K-8 drop-off (same)" },
          { time: "6:35a", label: "WASHINGTON BLVD AT HIGHLAND DR — P10 eliminated; stop orphaned, no other route at this location" },
          { time: "6:42a", label: "Walk ~0.34 mi to Rt 74 at DEAN ST AT LARIMER AVE (40.469°N, 79.906°W — stop E16270; major-reduced in FY26)" },
          { time: "6:52a", label: "Board 74 Homewood–Squirrel Hill inbound (illustrative)" },
          { time: "7:34a", label: "Downtown late — walk to Liberty & Smithfield" },
          { time: "7:45a+", label: "After clock-in / disciplinary risk (illustrative)" },
          {
            time: "Quarterly",
            label:
              "Doctor visits: same UPMC Shadyside clinic — midday means walk to 74 or Rt 82 on Lincoln Ave (~0.72 mi / 14 min from old P10 stop); both major-reduced with thinner headways (illustrative)",
          },
        ],
      },
      /** @type {JourneySegment[]} */
      journeyBefore: [
        {
          edgeKind: "firstMile",
          edgeLabel:
            "walk with kid to Pittsburgh Lincoln K-8, 328 Lincoln Ave (PRT stop data: LLB)",
          minutes: 14,
          nodeLabel: "school",
          stepPhoto: { side: "right" },
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to WASHINGTON BLVD AT HIGHLAND DR (40.474°N — sole P10 stop; no other route here)",
          minutes: 6,
          nodeLabel: "WASHINGTON BLVD AT HIGHLAND DR",
        },
        {
          edgeKind: "transit",
          edgeLabel:
            "P10 inbound → FIFTH AVE AT HAMILTON AVE (PRT labels this a 'commuter flyer'; Denise boards from the curb — illustrative)",
          minutes: 26,
          nodeLabel: "FIFTH AVE AT HAMILTON AVE",
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to Liberty Ave & Smithfield St (work)",
          minutes: 8,
          nodeLabel: "work (7:30a shift)",
        },
      ],
      /** @type {JourneySegment[]} */
      journeyAfter: [
        {
          edgeKind: "firstMile",
          edgeLabel: "walk with kid to Lincoln K-8 (same)",
          minutes: 14,
          nodeLabel: "school",
          stepPhoto: { side: "right" },
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to WASHINGTON BLVD AT HIGHLAND DR — stop orphaned",
          minutes: 6,
          nodeLabel: "WASHINGTON BLVD AT HIGHLAND DR (orphaned)",
        },
        {
          edgeKind: "uncertain",
          edgeLabel: "P10 eliminated — no other route at this stop; walk ~0.34 mi to nearest Rt 74",
          minutes: 10,
          nodeLabel: "replanning",
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to 74 at DEAN ST AT LARIMER AVE (40.469°N, stop E16270)",
          minutes: 7,
          nodeLabel: "74 stop",
        },
        {
          edgeKind: "transit",
          edgeLabel: "74 Homewood–Squirrel Hill → Downtown (major reduction; illustrative)",
          minutes: 42,
          nodeLabel: "Downtown (late)",
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to Liberty & Smithfield",
          minutes: 10,
          nodeLabel: "work (after clock-in)",
        },
      ],
      trips: [
        { time: "6:15am", description: "Leaves composite home — Washington Pl. (illustrative)" },
        { time: "6:29am", description: "Kid at Lincoln K-8, 328 Lincoln Ave" },
        { time: "6:41am", description: "Boards P10 at WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W)" },
        { time: "7:07am", description: "FIFTH AVE AT HAMILTON AVE; walks to shift" },
      ],
      stats: [
        { value: "54 min", label: "home to clock-in" },
        { value: "32.6%", label: "neighborhood poverty rate" },
        { value: "25.8%", label: "transit-commute proxy (workers)" },
        { value: "0", label: "car backup" },
      ],
      statsAfter: [
        { value: "89+ min", label: "home to clock-in (late)" },
        { value: "7 of 8", label: "routes cut or eliminated" },
        { value: "P10 gone", label: "stop orphaned — no replacement" },
      ],
      afterCut: {
        type: "critical",
        items: [
          "P10 eliminated — PRT classifies it as a commuter flyer, but in LLB it's a street-level bus stop (40.474°N, 79.908°W) in a neighborhood where 1 in 3 residents is below poverty. No park-and-ride. No car backup. The flyer label reflects PRT's operational tier, not the rider profile at this curb.",
          "WASHINGTON BLVD AT HIGHLAND DR (stop E56360) is orphaned — no other route at this stop in `route_stop_per_route.csv`. The stop doesn't just lose frequency; it disappears from the map.",
          "Nearest fallback: Rt 74 at DEAN ST AT LARIMER AVE (~0.34 mi / 7 min walk, stop E16270) — itself facing a major FY26 frequency reduction. Next option: Rt 82 on Lincoln Ave (~0.72 mi / 14 min walk, stop E35920) — also major-reduced.",
          "Compound impact: 7 of 8 LLB routes are cut or eliminated (P10 eliminated, P17 eliminated, routes 1/74/75/82/91 major-reduced). Only Rt 079 is unaffected. Meanwhile, Stanton Heights keeps all 3 routes — including Rt 089, explicitly retained for equity.",
          "Same kid drop at Lincoln K-8; same shift at Liberty & Smithfield. Quarterly UPMC Shadyside visits get harder midday — fewer spare minutes and worse connections on every remaining route.",
          "No household car — rideshare or informal rides fill gaps (cost, weather, child care).",
        ],
      },
    },
  },
};
