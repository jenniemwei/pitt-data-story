/** Default copy for `ScrollDemographics` (71B vs P10 abstract scrolly). */
export const scrollDemographicsNarrative = {
  ui: {
    sectionTitle: "",
    sectionIntro:
      "The same FY26 budget pressure lands as a minor trim (and a future BRT spine) on one alignment while the other — P10, labeled a commuter flyer but boarded from a street-level curb in a 32.6%-poverty neighborhood — is eliminated. WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W) has no other route in the stop data. The illustration samples neighborhood context those decisions inherit.",
    stickyAriaLabel:
      "Abstract map comparing 71B Highland Park and P10 Allegheny Valley Flyer; scroll steps show poverty, transit dependence, and ridership-weighted scale",
    legendRidership: "Line thickness ∝ recent weekday boardings along each segment (neighborhood stops; FY26_route_status_all).",
    legendPoverty:
      "Poverty % at each stop along the paths; segment thickness scales with local poverty intensity (Highland Park vs Lincoln-Lemington–Belmar ~5% vs ~33% below poverty in `fy26_route_n_profiles_all`, 2022 ACS fields).",
    legendTransit:
      "Transit-commute proxy (workers) from the same table — segment thickness scales with dependence (~26% vs ~11% of workers on the two corridor profiles).",
    sourceNote:
      "Ridership: FY26_route_status_all weekday_avg_riders_recent_2023_2024. Poverty / transit proxy: fy26_route_n_profiles_all (Highland Park & Lincoln-Lemington-Belmar). Stop coordinates: route_stop_per_route.csv (E56360 orphaned P10 stop, E16270 nearest Rt 74 fallback). Abstract path stops remain illustrative.",
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
      summaryPovertyPct: 4.8,
      summaryPovertyCount: 305,
      summaryTransitCommutePct: 11.1,
      summaryPopulation: 6400,
      neighborhoodImpact: {
        routesBeforeCount: 5,
        routesEliminatedCount: 1,
        routesMajorReducedCount: 4,
        pctRoutesImpacted: 100,
      },
      stops: [
        { t: 0.08, ridership: 4100, povertyPct: 4, povertyCount: 80, transitPct: 10 },
        { t: 0.28, ridership: 4000, povertyPct: 5, povertyCount: 120, transitPct: 11 },
        { t: 0.48, ridership: 3900, povertyPct: 5, povertyCount: 150, transitPct: 11 },
        { t: 0.68, ridership: 3850, povertyPct: 5, povertyCount: 130, transitPct: 11 },
        { t: 0.88, ridership: 3800, povertyPct: 5, povertyCount: 100, transitPct: 11 },
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
      body: "71B touches a lower-poverty corridor (Highland Park ~5% below poverty in `fy26_route_n_profiles_all`). P10 threads Lincoln-Lemington–Belmar — ~33% below poverty. PRT classifies P10 as a commuter flyer, but at 40.474°N on Washington Blvd there's no park-and-ride lot — just a curb in a neighborhood where 1 in 3 residents is below poverty. Same budget process, different baseline vulnerability.",
      overlay: "poverty",
    },
    {
      id: "transit",
      title: "Transit dependence",
      body: "Transit-commute proxy is higher in Lincoln-Lemington–Belmar than along Marcus's neighborhood profile (~26% vs ~11% of workers). LLB loses P10 and P17 (both eliminated) while routes 1, 74, 75, 82, and 91 all face major reductions — 7 of 8 routes impacted. Marcus's 71B stays in service with a minor reduction; Highland Park's neighborhood row also lists P10 among routes in that polygon — a different geographic slice than Denise's orphan stop at E56360.",
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
