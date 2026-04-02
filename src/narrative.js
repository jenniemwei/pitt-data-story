/**
 * Story copy and persona payloads. Single source for narrative components.
 * Income figures align with `data/demographics.csv` (Brookline, Homewood South).
 * Route labels echo `data/homewood_south_vs_lower_lawrenceville_story_data.csv`.
 * Stop distances / alternatives: confirm against `/data/gtfs/` before publish.
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
 */

export const personaDayCardNarrative = {
  ui: {
    sectionHeading: "Two commuters, one service cut",
    /** Full-story: opening chapter */
    sectionHeadingBefore: "Behind every ridership number is a place",
    sectionBeforeDek: "For some riders, PRT isn’t a nice-to-have. It’s how they get around.",
    /** Full-story: personas-after chapter (optional heading) */
    sectionHeadingAfter: "",
    sectionAfterDek: "",
    columnAriaLabelA: "Marcus, choice rider, Brookline",
    columnAriaLabelB: "Denise, dependent rider, Homewood South",
    timelineHeading: "Same morning, same system",
    statsHeading: "At a glance",
    consequencesHeading: "If the cut happens",
    manageableFooterTitle: "Alternatives available",
    criticalFooterTitle: "No viable alternative",
    journeyScaleNote:
      "Leg heights use illustrative minutes (not GTFS-schedule exact). Confirm waits and walks with GTFS and FY26 scenarios.",
    sharedRouteNote:
      "Both use this build’s neighborhood-route join for FY26 cuts; consequences are illustrative. Validate with GTFS walksheds.",
  },
  personas: {
    a: {
      name: "Marcus",
      tag: "Choice rider",
      neighborhood: "Brookline",
      incomeLabel: "$76,549 median household income",
      hasCar: true,
      carStatusLabel: "Household has a vehicle",
      startNodeLabel: "Home",
      /** @type {JourneySegment[]} */
      journeyBefore: [
        {
          edgeKind: "firstMile",
          edgeLabel: "drive to park-and-ride",
          minutes: 12,
          nodeLabel: "South Hills Village",
          stepPhoto: { side: "right" },
        },
        { edgeKind: "transit", edgeLabel: "RED Line", minutes: 34, nodeLabel: "Steel Plaza" },
        { edgeKind: "firstMile", edgeLabel: "walk", minutes: 6, nodeLabel: "office" },
      ],
      /** @type {JourneySegment[]} */
      journeyAfter: [
        { edgeKind: "firstMile", edgeLabel: "drive", minutes: 12, nodeLabel: "South Hills Village" },
        {
          edgeKind: "transit",
          edgeLabel: "RED Line · longer waits / slower recovery",
          minutes: 48,
          nodeLabel: "Steel Plaza",
        },
        { edgeKind: "firstMile", edgeLabel: "walk", minutes: 6, nodeLabel: "office" },
      ],
      trips: [
        { time: "6:50am", description: "Drives to South Hills Village park-and-ride" },
        { time: "7:05am", description: "Boards RED Line toward downtown" },
        { time: "7:42am", description: "Walks from Steel Plaza to office" },
      ],
      stats: [
        { value: "52 min", label: "total commute" },
        { value: "$0", label: "park-and-ride cost" },
        { value: "1", label: "transit leg (rail)" },
      ],
      statsAfter: [
        { value: "66 min", label: "total commute" },
        { value: "~$18", label: "parking if driving" },
        { value: "1", label: "transit leg (rail)" },
      ],
      afterCut: {
        type: "manageable",
        items: [
          "Can drive the rest of the way downtown: about +22 minutes and ~$18/day parking in the project scenario.",
          "Another frequent route stops within about 0.4 mile walk (confirm with GTFS).",
          "Employer transit benefit can cover a replacement monthly pass if rail frequency drops.",
        ],
      },
    },
    b: {
      name: "Denise",
      tag: "Dependent rider",
      neighborhood: "Homewood South",
      incomeLabel: "$24,376 median household income",
      hasCar: false,
      carStatusLabel: "No household vehicle",
      startNodeLabel: "Home",
      /** @type {JourneySegment[]} */
      journeyBefore: [
        {
          edgeKind: "firstMile",
          edgeLabel: "walk to stop",
          minutes: 12,
          nodeLabel: "P1 · East Busway",
          stepPhoto: { side: "right" },
        },
        {
          edgeKind: "transit",
          edgeLabel: "busway + transfer",
          minutes: 33,
          nodeLabel: "school drop",
          arrivalPhoto: { side: "left" },
        },
        { edgeKind: "transit", edgeLabel: "second leg", minutes: 15, nodeLabel: "near work" },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk",
          minutes: 7,
          nodeLabel: "work",
          arrivalPhoto: { side: "right" },
        },
      ],
      /** @type {JourneySegment[]} */
      journeyAfter: [
        {
          edgeKind: "firstMile",
          edgeLabel: "walk · nearest stop farther",
          minutes: 28,
          nodeLabel: "far bus stop",
          stepPhoto: { side: "right" },
          arrivalPhoto: { side: "left" },
        },
        { edgeKind: "transit", edgeLabel: "longer wait · crowded", minutes: 30, nodeLabel: "transfer" },
        {
          edgeKind: "uncertain",
          edgeLabel: "?? if corridor frequency holds",
          minutes: 14,
          nodeLabel: "school route",
        },
        { edgeKind: "transit", edgeLabel: "rerouted / extra transfer", minutes: 22, nodeLabel: "near work" },
        {
          edgeKind: "firstMile",
          edgeLabel: "walk from new stop",
          minutes: 20,
          nodeLabel: "work",
          arrivalPhoto: { side: "right" },
        },
      ],
      trips: [
        { time: "6:15am", description: "Boards P1 East Busway with her daughter" },
        { time: "6:48am", description: "Transfers; drops daughter at school" },
        { time: "7:22am", description: "Arrives at work" },
        { time: "Thu", description: "Same corridor for a medical appointment" },
      ],
      stats: [
        { value: "67 min", label: "total commute" },
        { value: "4", label: "transit legs / day" },
        { value: "0", label: "replacements within easy walk" },
      ],
      statsAfter: [
        { value: "~114 min", label: "total commute" },
        { value: "5+", label: "legs / worst days" },
        { value: "1.2 mi", label: "to nearest stop" },
      ],
      afterCut: {
        type: "critical",
        items: [
          "Next stop is about 1.2 miles away. Tough with a kid before 7am (check GTFS walkshed).",
          "Rideshare could run about $340/month, a big chunk of take-home at this income.",
          "Her daughter’s school remains reachable only if the east corridor still runs at usable frequency.",
          "Non-work trips (medical) depend on the same routes; there is no backup she can drive.",
        ],
      },
    },
  },
};

/** Shorthand for consumers that only need the two persona payloads. */
export const personas = personaDayCardNarrative.personas;

/**
 * Scroll-driven route comparison (divergence scene).
 * Figures from `data/FY26_route_status_all.csv` (RED reduced; 52L eliminated, Homewood anchor).
 * Stop weights on abstract paths are illustrative; validate with GTFS geometry.
 */
export const scrollDemographicsNarrative = {
  ui: {
    sectionTitle: "",
    sectionIntro:
      "With this plan, 52L is cut and RED is only reduced. Now let’s see who Denise and Marcus’s routes serve.",
    stickyAriaLabel:
      "Abstract map comparing RED Line and 52L; scroll steps show poverty, then transit commute share, then ridership",
    legendRidership: "Line thickness ∝ recent weekday boardings along each segment (neighborhood stops).",
    legendPoverty: "Line thickness ∝ modeled share below poverty at stop neighborhoods along each segment.",
    legendTransit: "Line thickness ∝ transit commute share (workers) at stops along each segment.",
    sourceNote:
      "Ridership: FY26_route_status_all weekday_avg_riders_recent_2023_2024. Poverty & commute: 2022 ACS fields in same table (composite geography along each route).",
    reducedMotionNote:
      "Reduced motion: showing poverty overlay. Read all three steps below for poverty, transit dependence, and ridership.",
  },
  routes: {
    keep: {
      id: "keep",
      personaName: "Marcus",
      routeCode: "RED",
      scheduleName: "RED (Castle Shannon via Beechview)",
      decisionNote: "High ridership, kept with cuts",
      lineColor: "#243a5e",
      pathD:
        "M 18 76 C 72 52, 118 96, 168 74 S 268 54, 318 70 S 362 88, 386 74",
      summaryRidershipRecent: 4267,
      summaryRidershipBaseline: 10533,
      summaryPovertyPct: 7.1,
      summaryPovertyCount: 1153,
      summaryTransitCommutePct: 10.7,
      summaryPopulation: 16290,
      stops: [
        { t: 0.08, ridership: 5200, povertyPct: 5.2, povertyCount: 210, transitPct: 8 },
        { t: 0.28, ridership: 4800, povertyPct: 6.1, povertyCount: 340, transitPct: 9 },
        { t: 0.48, ridership: 4100, povertyPct: 7.8, povertyCount: 280, transitPct: 11 },
        { t: 0.68, ridership: 3900, povertyPct: 8.4, povertyCount: 190, transitPct: 12 },
        { t: 0.88, ridership: 3600, povertyPct: 7.0, povertyCount: 133, transitPct: 10 },
      ],
    },
    cut: {
      id: "cut",
      personaName: "Denise",
      routeCode: "52L",
      scheduleName: "52L (Homewood Limited)",
      decisionNote: "Lower ridership vs. cost, slated to go",
      lineColor: "#141414",
      pathD:
        "M 16 220 C 88 248, 132 188, 198 212 S 292 232, 338 198 S 372 228, 388 206",
      summaryRidershipRecent: 258,
      summaryRidershipBaseline: 432,
      summaryPovertyPct: 36.3,
      summaryPovertyCount: 790,
      summaryTransitCommutePct: 19.9,
      summaryPopulation: 2177,
      stops: [
        { t: 0.1, ridership: 290, povertyPct: 32, povertyCount: 180, transitPct: 17 },
        { t: 0.3, ridership: 310, povertyPct: 38, povertyCount: 260, transitPct: 21 },
        { t: 0.5, ridership: 240, povertyPct: 41, povertyCount: 220, transitPct: 22 },
        { t: 0.7, ridership: 220, povertyPct: 35, povertyCount: 90, transitPct: 18 },
        { t: 0.9, ridership: 200, povertyPct: 34, povertyCount: 40, transitPct: 19 },
      ],
    },
  },
  steps: [
    {
      id: "poverty",
      title: "Poverty",
      body: "",
      overlay: "poverty",
    },
    {
      id: "transit",
      title: "Transit dependence",
      body: "",
      overlay: "transit",
    },
    {
      id: "efficiency",
      title: "Ridership",
      body: "RED: ~4,300 weekday riders. 52L: ~260.",
      overlay: "ridership",
    },
  ],
};

/** Copy for the home-page linear story (`StoryFullExperience`). */
export const fullStoryNarrative = {
  opening: {
    lead: "On a typical weekday morning, about 200,000 people in the Pittsburgh area figure out how to get where they’re going.",
    totalFigure: "200,000",
    totalCaption: "weekday travelers (illustrative regional total)",
    lifeline: "For some of them, transit isn’t a choice. It’s the system they rely on.",
    placeLine: "Behind every ridership number there’s a place and the people who live there.",
    prtFigure: "~100,000",
    prtCaption: "typical weekday riders on Pittsburgh Regional Transit",
    prtClosing: "Same agency, same map, not the same wiggle room when routes change.",
    figureTotalAria: "Circle representing all weekday travelers in the region",
    figurePrtAria: "Circle with lower half filled, representing roughly half of travelers riding PRT",
  },
  fy26: {
    kicker: "FY26 proposal",
    title: "",
    body:
      "In 2025 PRT floated cutting 41 bus routes and trimming 54 more, based on 'efficiency' calculated with ridership numbers.",
    stats: [
      { value: "41", label: "routes proposed for elimination" },
      { value: "54", label: "routes proposed for reduction" },
      { value: "3", label: "lines unchanged in this project scenario" },
    ],
    footnote: "Counts follow the FY26 scenario used in this build; confirm against published board materials.",
  },
  tripPurpose: {
    title: "Proxy Industry mix along each line (proxy data)",
    dek:
      "Despite the weekday ridership gap (~4,300 vs. ~260), we are losing 31 healthcare workers versus 14 and 37 retail and food-service workers versus 20 along 52L and the RED Line, respectively.",
    /** Corridor labels aligned with RED vs 52L story thread; `riderFraming` = choice vs need. */
    routes: [
      { id: "routeA", kind: "choice", corridorName: "RED Line", riderFraming: "Choice" },
      {
        id: "routeB",
        kind: "dependent",
        corridorName: "52L (Homewood Limited)",
        riderFraming: "Need",
      },
    ],
  },
  corridorMap: {
    sectionTitle: "",
    sectionIntro: "",
    reducedMotionNote:
      "Reduced motion: full step with regional map and metric controls. Switch poverty vs transit fills as needed.",
    fullEquityToggleLabel: "Show full regional map (all routes)",
    showPovertyLabel: "Poverty %",
    showTransitLabel: "Transit commute %",
    legendPoverty:
      "Poverty % — quartiles among RED/52L–touched hoods only, from lowest (warm beige) through peach, rust, and red. Hoods off the corridor stay muted grey-beige.",
    legendTransit:
      "Transit commute % — same quartile scaling on touched hoods (not poverty). Off-corridor muted.",
    legendFull:
      "Poverty vs transit toggles the same relative bins. Regional map uses quartiles across all land hoods.",
    legendRegional:
      "All land hoods binned by poverty quartiles, from light cream through peach, rust, and red. Routes use FY26 styling.",
    legendRegionalTransit:
      "Regional transit — quartiles on all land hoods; same accent palette; not poverty.",
    steps: [
      {
        id: "cm-poverty",
        title: "Poverty",
        body:
          "• Off corridor: muted grey-beige.\n• On corridor: quartiles of poverty among touched hoods — lowest bin is only slightly warmer beige than muted; then peach, rust, red.",
        phase: "poverty",
      },
      {
        id: "cm-transit",
        title: "Transit dependence",
        body:
          "• Same relative quartiles on workers’ transit-commute share among touched hoods.\n• Muted off-corridor; lowest on-corridor bin barely warmer than muted.\n• Not poverty.",
        phase: "transit",
      },
      {
        id: "cm-full",
        title: "Full view",
        body:
          "• Poverty vs transit toggle reuses these bins.\n• Regional map: every hood + all routes.",
        phase: "full",
      },
    ],
  },
  pullQuote: {
    text: "Ridership flattens human needs to numbers when the PRT is supposed to support those who need it first.",
  },
};
