/**
 * Story copy and persona payloads. Single source for narrative components.
 * Human-readable summary (keep in sync when personas change): `docs/PERSONAS.md`.
 * Neighborhood context: `data/fy26_route_n_profiles_all.csv` (Stanton Heights, Lincoln-Lemington-Belmar).
 * Stanton Heights median / no-car: confirm ACS pull — Marcus income below marked ILLUSTRATIVE in persona comment.
 * Denise pocket: Lincoln-Lemington-Belmar row — ~32.6% below poverty, ~25.8% transit-commute proxy, pop 4,485.
 * Denise arc: P10 (Allegheny Valley Flyer) from WASHINGTON BLVD AT HIGHLAND DR — sole route at that stop row in `route_stop_per_route.csv`; FY26 eliminates P10 (see `FY26_route_status_all`).
 * Composite household: home/school/work/doctor strings are illustrative for storytelling — verify addresses and walk times on a map + official timetables before presenting as fact.
 * Route labels echo FY26 schedule names (`data/FY26_route_status_all.csv`).
 * Stop names from `data/route_stop_per_route.csv`. No bundled `stop_times.txt` — clock times illustrative.
 */

/**
 * FY26 treatment for story routes (editorial layer; BRT flag is not in CSV).
 * @type {Record<string, { cutType: 'minor_reduction' | 'major_reduction' | 'eliminated'; brtUpgrade: boolean }>}
 */
export const STORY_ROUTE_FY26_LOOKUP = {
  "71B": { cutType: "minor_reduction", brtUpgrade: true },
  "82": { cutType: "major_reduction", brtUpgrade: false },
  "74": { cutType: "major_reduction", brtUpgrade: false },
  "91": { cutType: "major_reduction", brtUpgrade: false },
  "1": { cutType: "major_reduction", brtUpgrade: false },
  "75": { cutType: "major_reduction", brtUpgrade: false },
  P17: { cutType: "eliminated", brtUpgrade: false },
  P10: { cutType: "eliminated", brtUpgrade: false },
};

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

/** Shorthand for consumers that only need the two persona payloads. */
export const personas = personaDayCardNarrative.personas;

/**
 * Scroll-driven route comparison (divergence scene).
 * Ridership / poverty / transit summaries: `data/FY26_route_status_all.csv` (71B reduced minor; P10 eliminated).
 * Abstract stop weights are illustrative; validate with GTFS geometry.
 */
export const scrollDemographicsNarrative = {
  ui: {
    sectionTitle: "",
    sectionIntro:
      "The same FY26 budget pressure lands as a minor trim (and a future BRT spine) on one alignment while the other — Denise’s Allegheny Valley Flyer — is eliminated, removing one-seat service from stops like WASHINGTON BLVD AT HIGHLAND DR with no same-stop local in `route_stop_per_route`. The illustration samples neighborhood context those decisions inherit.",
    stickyAriaLabel:
      "Abstract map comparing 71B Highland Park and P10 Allegheny Valley Flyer; scroll steps show poverty, transit dependence, and ridership-weighted scale",
    legendRidership: "Line thickness ∝ recent weekday boardings along each segment (neighborhood stops; FY26_route_status_all).",
    legendPoverty:
      "Poverty % at each stop along the paths; segment thickness scales with local poverty intensity (Stanton Heights vs Lincoln-Lemington–Belmar ~10% vs ~33% below poverty in `fy26_route_n_profiles_all`, 2022 ACS fields).",
    legendTransit:
      "Transit-commute proxy (workers) from the same table — segment thickness scales with dependence (~26% vs ~9% of workers on the two corridor profiles).",
    sourceNote:
      "Ridership: FY26_route_status_all weekday_avg_riders_recent_2023_2024. Poverty / transit proxy: fy26_route_n_profiles_all (Stanton Heights & Lincoln-Lemington-Belmar). Abstract path stops remain illustrative.",
    reducedMotionNote:
      "Reduced motion: showing poverty overlay. Read all three steps below for poverty, transit dependence, and FY26-scale ridership.",
  },
  routes: {
    keep: {
      id: "keep",
      personaName: "Marcus",
      routeCode: "71B",
      scheduleName: "71B Highland Park",
      decisionNote: "Higher ridership; minor reduction; BRT upgrade corridor",
      lineColor: "#1d4ed8",
      pathD:
        "M 18 76 C 72 52, 118 96, 168 74 S 268 54, 318 70 S 362 88, 386 74",
      // Weekday avg recent from FY26_route_status_all (71B row)
      summaryRidershipRecent: 3958,
      summaryRidershipBaseline: 5020,
      // Stanton Heights row — below_poverty_pct * 100 ≈ 9.8
      summaryPovertyPct: 9.8,
      summaryPovertyCount: 435,
      // transit_dependent_pct_proxy * 100 ≈ 9.3
      summaryTransitCommutePct: 9.3,
      summaryPopulation: 4555,
      stops: [
        { t: 0.08, ridership: 4100, povertyPct: 8, povertyCount: 120, transitPct: 8 },
        { t: 0.28, ridership: 4000, povertyPct: 9, povertyCount: 160, transitPct: 9 },
        { t: 0.48, ridership: 3900, povertyPct: 10, povertyCount: 200, transitPct: 10 },
        { t: 0.68, ridership: 3850, povertyPct: 11, povertyCount: 140, transitPct: 11 },
        { t: 0.88, ridership: 3800, povertyPct: 10, povertyCount: 100, transitPct: 10 },
      ],
    },
    cut: {
      id: "cut",
      personaName: "Denise",
      routeCode: "P10",
      scheduleName: "P10 Allegheny Valley Flyer",
      decisionNote:
        "Eliminated in FY26 scenario (commuter-bus step); Washington Blvd stop pair has no overlapping local in build data",
      lineColor: "#c2410c",
      pathD:
        "M 16 220 C 88 248, 132 188, 198 212 S 292 232, 338 198 S 372 228, 388 206",
      // Weekday avg from FY26_route_status_all (P10 row): recent 221.3, baseline 698.1
      summaryRidershipRecent: 221,
      summaryRidershipBaseline: 698,
      // Lincoln-Lemington-Belmar profile row — below_poverty_pct * 100 ≈ 32.6
      summaryPovertyPct: 32.6,
      summaryPovertyCount: 1356,
      summaryTransitCommutePct: 25.8,
      summaryPopulation: 4485,
      stops: [
        { t: 0.1, ridership: 240, povertyPct: 30, povertyCount: 400, transitPct: 23 },
        { t: 0.3, ridership: 232, povertyPct: 33, povertyCount: 420, transitPct: 25 },
        { t: 0.5, ridership: 225, povertyPct: 34, povertyCount: 380, transitPct: 26 },
        { t: 0.7, ridership: 222, povertyPct: 33, povertyCount: 300, transitPct: 27 },
        { t: 0.9, ridership: 218, povertyPct: 32, povertyCount: 200, transitPct: 26 },
      ],
    },
  },
  steps: [
    {
      id: "poverty",
      title: "Poverty",
      body: "71B touches a lower-poverty corridor profile (Stanton Heights ~10% below poverty in this build’s neighborhood table). P10 threads Larimer, Lincoln-Lemington–Belmar, and other pockets — LLB ~33% below poverty. Same budget process — different baseline vulnerability.",
      overlay: "poverty",
    },
    {
      id: "transit",
      title: "Transit dependence",
      body: "Transit commute proxy is higher in Lincoln-Lemington–Belmar than along Marcus’s side (~26% vs ~9% of workers in the profile table). That pocket loses P10 and P17 in `fy26_route_n_profiles_all` while major-reduced locals remain.",
      overlay: "transit",
    },
    {
      id: "efficiency",
      title: "Ridership (PRT’s efficiency input)",
      body: "71B: ~4,000 recent weekday riders vs. P10: ~220 — efficiency framing targets smaller routes for elimination even when a stop like WASHINGTON BLVD AT HIGHLAND DR has no same-stop duplicate in `route_stop_per_route`.",
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
    prtClosing: "When the same fiscal crisis hits two corridors, ridership scores don’t tell you who still has a usable schedule — and who doesn’t.",
    figureTotalAria: "Circle representing all weekday travelers in the region",
    figurePrtAria: "Circle with lower half filled, representing roughly half of travelers riding PRT",
  },
  fy26: {
    kicker: "FY26 proposal",
    title: "",
    body:
      "In 2025 PRT floated cutting 41 bus routes and trimming 54 more, ranked with ridership-based “efficiency.” That neutral-sounding metric can steer savings toward corridors that already have higher loads — and away from places where people ride because they must. Frequency cuts rarely read like eliminations in headlines, but they can erase the trips that make transit work for shift parents.",
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
      "PRT doesn’t publish trip purpose data. Industry employment mix along each corridor proxies for discretionary vs. essential travel. The 71B serves a corridor with high office and professional employment. P10 / Washington–Fifth–busway connects Lincoln-Lemington–Belmar, Larimer, and Homewood West to Downtown and the East End — proxy mix tilts toward healthcare, retail, education, and food service along that spine.",
    routes: [
      {
        id: "routeA",
        kind: "choice",
        corridorName: "71B Highland Park — Choice",
        riderFraming: "",
      },
      {
        id: "routeB",
        kind: "dependent",
        corridorName: "P10 Allegheny Valley — Need",
        riderFraming: "",
      },
    ],
  },
  corridorMap: {
    sectionTitle: "",
    sectionIntro:
      "Neighborhood demographics (2022 ACS) and the transit-commute proxy read differently along each alignment. The same FY26 process applies a minor reduction (and future BRT spine) to 71B while eliminating P10 — including stops like WASHINGTON BLVD AT HIGHLAND DR with no overlapping local in this build’s `route_stop_per_route` table. Scroll the steps for poverty on the land plate, grey dots sized by transit dependence, then both with FY26 route styling.",
    reducedMotionNote:
      "Reduced motion: FY26 outcomes step with optional full-region view (all routes). Scroll steps above drive poverty → transit → bivariate dot map.",
    fullEquityToggleLabel: "Show full regional map (all routes)",
    showPovertyLabel: "Poverty %",
    showTransitLabel: "Transit commute %",
    legendPoverty: "Poverty % (71B/P10 hoods). Bands fill in once data loads.",
    legendTransit: "Larger dots = higher transit commute % (all dots).",
    legendFull: "Transit and poverty together (size + color).",
    legendRegional: "Same legend, full region.",
    legendRegionalTransit: "Regional map + routes toggle.",
    /** Shown in “Sources & methods” for the map; appended to rationale icon. */
    methodNoteBrt:
      "71B is named as part of the Downtown–Oakland–East End BRT spine (University Line) in PRT BRT Service Plan materials — dedicated lanes, stations, and signal priority are planned along that corridor; confirm current milestones. This build’s FY26 table codes 71B as reduced/minor (e.g. late-night span) — not eliminated.",
    steps: [
      {
        id: "cm-poverty",
        title: "Poverty",
        body:
          "• Stanton Heights ~10% below poverty vs. Lincoln-Lemington–Belmar ~33% in this build’s neighborhood profile (`fy26_route_n_profiles_all`).\n• 71B-side touches read as lower-poverty; the P10 / east-end pocket is tagged eliminated;reduced on routes in the same table.",
        phase: "poverty",
      },
      {
        id: "cm-transit",
        title: "Transit dependence",
        body:
          "• Stanton Heights: moderate transit commute proxy (~9% of workers in profile table), most households have a car.\n• Lincoln-Lemington–Belmar: higher transit proxy (~26%) plus P10 / P17 eliminations and 82 / 74 / 91 / 1 major reductions in `FY26_route_status_all` — fewer one-seat options after cuts.",
        phase: "transit",
      },
      {
        id: "cm-full",
        title: "FY26 outcomes",
        body:
          "• 71B Highland Park: minor reduction in this scenario — plus BRT infrastructure upgrade on the regional spine.\n• P10 Allegheny Valley Flyer: eliminated — Denise’s arc boards at WASHINGTON BLVD AT HIGHLAND DR (no same-stop local in `route_stop_per_route`).\n• P17 Lincoln Park Flyer: eliminated; 82 Lincoln: major reduction — same Lincoln Ave stop family for neighbors on that spine.\n• Same budget crisis. Ridership and efficiency labels do not replace timetable reality.",
        phase: "full",
      },
    ],
  },
  pullQuote: {
    text: "PRT can cut a flyer and say other routes still exist somewhere in the network. What they can't say honestly is that the rider at WASHINGTON BLVD AT HIGHLAND DR — where only P10 stopped in this data — still has the same one-seat ride from the curb they used.",
  },
  equityDotMap: {
    title: "Two pressures on the same map",
    dek:
      "Dots sit on one regional lattice; simplified boundaries assign each dot to a neighborhood. Zooming in refines the lattice (more dots); the largest transit-dependence tier stays tangent at the active pitch. Color shows poverty; size shows transit dependence — both scaled to how neighborhoods compare in this dataset, not national cutoffs.",
    showAllRoutesLabel: "Show all routes",
  },
};
