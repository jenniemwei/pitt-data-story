/** Trip purpose proxy viz — titles, dek, route labels (`TripPurposeProxy` / `fullStoryNarrative.tripPurpose`). */

export const tripPurpose = {
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
};
