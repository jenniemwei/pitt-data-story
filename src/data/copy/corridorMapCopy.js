/**
 * Corridor map + abstract scroll demographics viz copy (`CorridorScrollMap`, `ScrollDemographics`).
 * Ridership / poverty / transit summaries: `data/FY26_route_status_all.csv` (71B reduced minor; P10 eliminated).
 * Abstract stop weights are illustrative; validate with GTFS geometry.
 *
 * ## Flyer-classification framing (Apr 2026 review)
 *
 * P10 is classified by PRT as a commuter flyer. In Lincoln-Lemington-Belmar (32.6% poverty,
 * 25.8% transit dependence), P10 has a street-level stop at WASHINGTON BLVD AT HIGHLAND DR
 * (40.474002, −79.908205, stop E56360) — no park-and-ride lot, no overlapping local. PRT's
 * efficiency logic targets low-ridership routes for elimination; that metric is blind to the
 * poverty profile of who actually boards at these curb stops. The flyer label is PRT's
 * operational tier, not the rider's lived experience.
 *
 * Compound impact on LLB: 7 of 8 routes affected (P10, P17 eliminated; 1, 74, 75, 82, 91
 * major-reduced; only 079 unaffected). Stanton Heights: 0 eliminated, Rt 089 retained for
 * equity, 087/091 major-reduced.
 */

/** Scroll-driven route comparison (divergence scene) — SVG scrolly + shared source strings for the Mapbox chapter. */
export const scrollDemographicsNarrative = {
  ui: {
    sectionTitle: "",
    sectionIntro:
      "The same FY26 budget pressure lands as a minor trim (and a future BRT spine) on one alignment while the other — P10, labeled a commuter flyer but boarded from a street-level curb in a 32.6%-poverty neighborhood — is eliminated. WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W) has no other route in the stop data. The illustration samples neighborhood context those decisions inherit.",
    stickyAriaLabel:
      "Abstract map comparing 71B Highland Park and P10 Allegheny Valley Flyer; scroll steps show poverty, transit dependence, and ridership-weighted scale",
    legendRidership: "Line thickness ∝ recent weekday boardings along each segment (neighborhood stops; FY26_route_status_all).",
    legendPoverty:
      "Poverty % at each stop along the paths; segment thickness scales with local poverty intensity (Stanton Heights vs Lincoln-Lemington–Belmar ~10% vs ~33% below poverty in `fy26_route_n_profiles_all`, 2022 ACS fields).",
    legendTransit:
      "Transit-commute proxy (workers) from the same table — segment thickness scales with dependence (~26% vs ~9% of workers on the two corridor profiles).",
    sourceNote:
      "Ridership: FY26_route_status_all weekday_avg_riders_recent_2023_2024. Poverty / transit proxy: fy26_route_n_profiles_all (Stanton Heights & Lincoln-Lemington-Belmar). Stop coordinates: route_stop_per_route.csv (E56360 orphaned P10 stop, E16270 nearest Rt 74 fallback). Abstract path stops remain illustrative.",
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
      summaryRidershipRecent: 3958,
      summaryRidershipBaseline: 5020,
      summaryPovertyPct: 9.8,
      summaryPovertyCount: 435,
      summaryTransitCommutePct: 9.3,
      summaryPopulation: 4555,
      neighborhoodImpact: {
        routesBeforeCount: 3,
        routesEliminatedCount: 0,
        routeRetainedForEquity: "089",
        pctRoutesImpacted: 66.7,
      },
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
        "Eliminated in FY26 (commuter-bus tier). PRT classifies P10 as a commuter flyer, but in LLB it serves a street-level curb stop (40.474°N, 79.908°W, E56360) in a 32.6%-poverty neighborhood — no park-and-ride, no same-stop substitute.",
      lineColor: "#c2410c",
      pathD:
        "M 16 220 C 88 248, 132 188, 198 212 S 292 232, 338 198 S 372 228, 388 206",
      summaryRidershipRecent: 221,
      summaryRidershipBaseline: 698,
      summaryPovertyPct: 32.6,
      summaryPovertyCount: 1356,
      summaryTransitCommutePct: 25.8,
      summaryPopulation: 4485,
      neighborhoodImpact: {
        routesBeforeCount: 8,
        routesEliminatedCount: 2,
        routesMajorReducedCount: 5,
        pctRoutesImpacted: 87.5,
        orphanedStopId: "E56360",
        orphanedStopName: "WASHINGTON BLVD AT HIGHLAND DR",
        orphanedStopLat: 40.474002,
        orphanedStopLon: -79.908205,
        nearestFallbackStopId: "E16270",
        nearestFallbackName: "DEAN ST AT LARIMER AVE (Rt 74)",
        nearestFallbackWalkMi: 0.34,
        nearestFallbackWalkMin: 7,
      },
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
      body: "71B touches a lower-poverty corridor (Stanton Heights ~10% below poverty). P10 threads Lincoln-Lemington–Belmar — ~33% below poverty. PRT classifies P10 as a commuter flyer, but at 40.474°N on Washington Blvd there's no park-and-ride lot — just a curb in a neighborhood where 1 in 3 residents is below poverty. Same budget process, different baseline vulnerability.",
      overlay: "poverty",
    },
    {
      id: "transit",
      title: "Transit dependence",
      body: "Transit-commute proxy is higher in Lincoln-Lemington–Belmar than along Marcus's side (~26% vs ~9% of workers). LLB loses P10 and P17 (both eliminated) while routes 1, 74, 75, 82, and 91 all face major reductions — 7 of 8 routes impacted. In Stanton Heights, Rt 089 was explicitly retained for equity; all 3 routes survive.",
      overlay: "transit",
    },
    {
      id: "efficiency",
      title: "Ridership (PRT's efficiency input)",
      body: "71B: ~4,000 recent weekday riders vs. P10: ~220 — efficiency framing targets smaller routes for elimination. But that metric doesn't ask who boards at WASHINGTON BLVD AT HIGHLAND DR (stop E56360, no other route) or whether they have a car in the driveway. The flyer label is PRT's classification; the orphaned stop is the rider's reality.",
      overlay: "ridership",
    },
  ],
};

/** Mapbox corridor scroll chapter — legends, step copy, intro (`CorridorScrollMap` / `fullStoryNarrative.corridorMap`). */
export const corridorMap = {
  sectionTitle: "",
  sectionIntro:
    "Neighborhood demographics (2022 ACS) and the transit-commute proxy read differently along each alignment. PRT's FY26 process applies a minor reduction (and future BRT spine) to 71B while eliminating P10 — classified as a commuter flyer, but serving a street-level stop (40.474°N, 79.908°W) in a 32.6%-poverty neighborhood with no same-stop alternative. Scroll the steps for poverty on the land plate, grey dots sized by transit dependence, then both with FY26 route styling.",
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
  methodNoteBrt:
    "71B is named as part of the Downtown–Oakland–East End BRT spine (University Line) in PRT BRT Service Plan materials — dedicated lanes, stations, and signal priority are planned along that corridor; confirm current milestones. This build's FY26 table codes 71B as reduced/minor (e.g. late-night span) — not eliminated.",
  steps: [
    {
      id: "cm-poverty",
      title: "Poverty",
      body:
        "• Stanton Heights ~10% below poverty vs. Lincoln-Lemington–Belmar ~33% (`fy26_route_n_profiles_all`).\n• Same budget process — 71B-side is lower-poverty; the P10 / east-end pocket is tagged eliminated;reduced.",
      phase: "poverty",
    },
    {
      id: "cm-transit",
      title: "Transit dependence",
      body:
        "• Stanton Heights: ~9% transit-commute proxy, most households have a car. Rt 089 retained for equity — all 3 routes survive.\n• Lincoln-Lemington–Belmar: ~26% transit proxy, 7 of 8 routes cut or eliminated (P10 + P17 eliminated; 1/74/75/82/91 major-reduced). The flyer label doesn't change the compound impact.",
      phase: "transit",
    },
    {
      id: "cm-full",
      title: "FY26 outcomes",
      body:
        "• 71B Highland Park: minor reduction — plus BRT infrastructure upgrade on the regional spine.\n• P10 Allegheny Valley Flyer: eliminated. PRT calls it a commuter flyer; Denise boards from a curb at 40.474°N on Washington Blvd — no park-and-ride, no overlapping route. When P10 is cut, stop E56360 disappears.\n• P17 Lincoln Park Flyer: also eliminated, but its Lincoln Ave stops are co-served by Rt 82 (itself major-reduced).\n• Compound: 7 of 8 LLB routes affected vs. 0 of 3 eliminated in Stanton Heights.\n• Same budget crisis. Ridership and efficiency labels do not capture who still has a usable ride.",
      phase: "full",
    },
  ],
};
