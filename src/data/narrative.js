/**
 * Story assembly: opening, FY26 stats, pull quote, dot map — plus re-exports for viz copy modules.
 *
 * Layout row registry (semantic ids + `GalleryRow` variants): `src/data/structure.js`.
 * Viz copy lives under `src/data/copy/`:
 * - `corridorMapCopy.js` — Mapbox corridor chapter + abstract scroll demographics (`corridorMap`, `scrollDemographicsNarrative`)
 * - `tripPurposeCopy.js` — trip purpose proxy (`tripPurpose`)
 * - `personaJourneyCopy.js` — persona cards, journeys before/after (`personaDayCardNarrative`)
 *
 * Human-readable persona summary: `docs/PERSONAS.md`.
 *
 * ## Pairing & flyer-classification framing (Apr 2026 review)
 *
 * LLB (4,485 pop, 32.6% poverty, 25.8% transit dep) vs Stanton Heights (4,555 pop, 9.8%
 * poverty, 9.3% transit dep). P10 is PRT-classified as a commuter flyer, but serves a
 * street-level curb stop (E56360, 40.474002 / −79.908205) in LLB with no other route. The
 * flyer label is PRT's operational tier; it does not reflect the rider profile of a 32.6%-
 * poverty neighborhood. Compound impact: 7 of 8 LLB routes affected vs 0 eliminated in SH.
 * Route 089 in SH was explicitly retained for equity.
 *
 * Composite household strings are illustrative — verify on a map + timetables before presenting as fact.
 */

import { corridorMap, scrollDemographicsNarrative } from "./copy/corridorMapCopy";
import { personaDayCardNarrative, storyStopCoordinates, neighborhoodFY26Impact } from "./copy/personaJourneyCopy";
import { tripPurpose } from "./copy/tripPurposeCopy";

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

export { personaDayCardNarrative, scrollDemographicsNarrative, corridorMap, tripPurpose, storyStopCoordinates, neighborhoodFY26Impact };

/** Shorthand for consumers that only need the two persona payloads. */
export const personas = personaDayCardNarrative.personas;

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
  tripPurpose,
  corridorMap,
  pullQuote: {
    text: "PRT classifies P10 as a commuter flyer — designed for suburban park-and-ride commuters. But at WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W), there's no parking lot. There's a curb in a neighborhood where 1 in 3 residents is below poverty. When PRT eliminates P10 for low efficiency, the stop disappears. The nearest alternative is a 7-minute walk to a route that itself runs less often. And that's just one of 7 routes cut or eliminated in this neighborhood. The flyer label is PRT's classification. The orphaned stop is the rider's reality.",
  },
  equityDotMap: {
    title: "Two pressures on the same map",
    dek:
      "Dots sit on one regional lattice; simplified boundaries assign each dot to a neighborhood. Zooming in refines the lattice (more dots); the largest transit-dependence tier stays tangent at the active pitch. Color shows poverty; size shows transit dependence — both scaled to how neighborhoods compare in this dataset, not national cutoffs.",
    showAllRoutesLabel: "Show all routes",
  },
};
