/**
 * Persona day card — UI strings, journeys before/after, schedules, stats, consequences (`PersonaDayCard`).
 * Human-readable summary: `docs/PERSONAS.md`.
 * Neighborhood context: `data/fy26_route_n_profiles_all.csv` (Stanton Heights, Lincoln-Lemington-Belmar).
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

export const personaDayCardNarrative = {
  ui: {
    sectionHeading: "Two commuters, one budget crisis",
    /** Full-story: opening chapter */
    sectionHeadingBefore: "Behind every ridership number is a place",
    sectionBeforeDek: "For some riders, PRT isn’t a nice-to-have. It’s how they get around.",
    /** Full-story: personas-after chapter (optional heading) */
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
      "Leg heights use illustrative minutes (not GTFS-schedule exact). Denise’s home, school, work, and doctor labels are a composite scene — confirm walk distances and clock times with a map and PRT FY26 timetables. This repo has no bundled `stop_times.txt`.",
    sharedRouteNote:
      "FY26 pairing in this build: 71B Highland Park (minor reduction; BRT spine in regional plan) vs. Denise on P10 (Allegheny Valley Flyer) at WASHINGTON BLVD AT HIGHLAND DR — the only route at that stop in `route_stop_per_route.csv`, so no same-stop local substitute. P10 is eliminated in scenario tables; her illustrative fallback is a longer walk to major-reduced 74 (HIGHLAND DR OPP JOB CORPS DR / WILTSIE ST AT HIGHLAND DR FS). Lincoln Ave riders still face the paired P17/82 story separately.",
  },
  personas: {
    a: {
      name: "Marcus",
      tag: "Choice rider",
      neighborhood: "Stanton Heights",
      // ILLUSTRATIVE — confirm from ACS pull (user brief: ACS 2023 ~$77,978)
      incomeLabel: "$77,978 median household income (ACS 2023 — confirm)",
      hasCar: true,
      carStatusLabel: "Household has a vehicle",
      startNodeLabel: "Home",
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
        // ILLUSTRATIVE — confirm zero-vehicle / no-car household share from ACS
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
      /**
       * Morning timeline — home, school, work, doctor (composite). Rendered when `daySchedule` is supported.
       * @type {DaySchedule}
       */
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
          { time: "6:35a", label: "Walk to WASHINGTON BLVD AT HIGHLAND DR (PRT stop; P10 only at this pair in build data)" },
          { time: "6:41a", label: "Board P10 Allegheny Valley Flyer inbound (Fifth Ave / East Busway pattern — illustrative)" },
          { time: "7:07a", label: "Alight FIFTH AVE AT HAMILTON AVE — walk to Liberty & Smithfield" },
          { time: "7:30a", label: "Clock-in" },
        ],
        afterRows: [
          { time: "Places", label: "Same home, school, work & doctor as before — commute path changes" },
          { time: "6:15a", label: "Leave home; Lincoln K-8 drop-off (same)" },
          { time: "6:35a", label: "WASHINGTON BLVD AT HIGHLAND DR — no P10; replan (illustrative wait)" },
          { time: "6:45a", label: "Walk to 74 — HIGHLAND DR OPP JOB CORPS DR (major-reduced 74 in FY26 scenario)" },
          { time: "6:52a", label: "Board 74 Homewood–Squirrel Hill inbound (illustrative)" },
          { time: "7:34a", label: "Downtown late — walk to Liberty & Smithfield" },
          { time: "7:45a+", label: "After clock-in / disciplinary risk (illustrative)" },
          {
            time: "Quarterly",
            label:
              "Doctor visits: same UPMC Shadyside clinic — after cuts, midday means a longer walk to 74 + thinner headways on major-reduced locals (illustrative)",
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
          edgeLabel: "walk to WASHINGTON BLVD AT HIGHLAND DR (sole P10 boarding pair here)",
          minutes: 6,
          nodeLabel: "WASHINGTON BLVD AT HIGHLAND DR",
        },
        {
          edgeKind: "transit",
          edgeLabel:
            "P10 Allegheny Valley Flyer inbound → FIFTH AVE AT HAMILTON AVE (via Fifth / busway — illustrative)",
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
          edgeLabel: "walk to WASHINGTON BLVD AT HIGHLAND DR — no bus",
          minutes: 6,
          nodeLabel: "WASHINGTON BLVD AT HIGHLAND DR",
        },
        {
          edgeKind: "uncertain",
          edgeLabel: "P10 eliminated — no other route at this stop pair in build data (illustrative)",
          minutes: 10,
          nodeLabel: "replanning",
        },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to 74 at HIGHLAND DR OPP JOB CORPS DR",
          minutes: 14,
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
        { time: "6:41am", description: "Boards P10 at WASHINGTON BLVD AT HIGHLAND DR" },
        { time: "7:07am", description: "FIFTH AVE AT HAMILTON AVE; walks to shift" },
      ],
      stats: [
        { value: "54 min", label: "home to clock-in" },
        { value: "25.8%", label: "transit-commute proxy (workers)" },
        { value: "0", label: "car backup" },
      ],
      statsAfter: [
        { value: "96+ min", label: "or late / rideshare" },
        { value: "~$300–400/mo", label: "rideshare if she covers gaps" },
        { value: "P10 gone", label: "stop orphaned" },
      ],
      afterCut: {
        type: "critical",
        items: [
          "P10 (Allegheny Valley Flyer) eliminated — WASHINGTON BLVD AT HIGHLAND DR has no overlapping local in `route_stop_per_route`; the stop she timed her morning around disappears from the map, not just the headway.",
          "74 remains but with a major FY26 reduction — longer walk to HIGHLAND DR OPP JOB CORPS DR plus thinner frequency and longer in-vehicle time (illustrative).",
          "Same kid drop at Lincoln K-8; same shift at Liberty & Smithfield. Quarterly UPMC Shadyside visits get harder midday — fewer spare minutes and worse connections.",
          "P17 / 82 on Lincoln is a different geometry for neighbors; Denise’s story is elimination without a same-stop substitute.",
          "No household car — rideshare or informal rides fill gaps (cost, weather, child care).",
        ],
      },
    },
  },
};
