/**
 * Layout registry: semantic `id` + `GalleryRow` variant / measure for each story band.
 * Use `data-layout-id` on the matching DOM node (often the `GalleryRow` root or scroll shell).
 *
 * Variant + measure strings must stay in sync with `GalleryRow` (`src/components/layout/GalleryRow.jsx`).
 */

/**
 * @typedef {"60-40"|"40-60"|"50-50"|"100"|"70-30"|"30-70"|"75-25"|"25-75"|"fit-fill"|"fill-fit"} GalleryRowVariant
 */

/**
 * @typedef {"gallery"|"content"} GalleryRowMeasure
 */

/**
 * @typedef {{
 *   id: string;
 *   variant: GalleryRowVariant;
 *   measure?: GalleryRowMeasure;
 *   sectionId?: string | null;
 *   label: string;
 * }} LayoutRowDef
 */

/** Default measure for narrative / viz rows (height from content, no strip aspect-ratio). */
export const defaultStoryMeasure = /** @type {const} */ ("content");

/** Home (`app/page.js`) — title + dek. */
export const homePageStructure = {
  introRow: /** @type {const} */ ({
    id: "storyline-intro-1",
    variant: "100",
    measure: "content",
    sectionId: null,
    label: "Home page intro",
  }),
};

/**
 * Linear story (`StoryFullExperience`) — chapter-level gallery rows and corridor substrips.
 * `sectionId` matches `id` on `<section>` where applicable.
 */
export const storyExperienceStructure = {
  storyOpening: /** @type {const} */ ({
    id: "storyline-1",
    variant: "100",
    measure: "content",
    sectionId: "story-opening",
    label: "Regional scale opening",
  }),
  personaBefore: /** @type {const} */ ({
    id: "storyline-persona-1",
    variant: "100",
    measure: "content",
    sectionId: "persona-before",
    label: "Persona card pair (before)",
  }),
  fy26Plan: /** @type {const} */ ({
    id: "storyline-fy26-1",
    variant: "100",
    measure: "content",
    sectionId: "fy26-plan",
    label: "FY26 plan stats",
  }),
  /** Map column + steps (`ScrollDemographics` shell in `CorridorScrollMap`). */
  corridorMapShell: /** @type {const} */ ({
    id: "corridor-map-shell-1",
    variant: "75-25",
    measure: "content",
    sectionId: "corridor-map",
    label: "Corridor Mapbox sticky + narrative steps",
  }),
  /** Sticky column: Mapbox map + controls + readouts (first track of `corridorMapShell`). */
  corridorMapVis1: /** @type {const} */ ({
    id: "corridor-map-vis-1",
    variant: "75-25",
    measure: "content",
    sectionId: "corridor-map",
    label: "Corridor Mapbox sticky column",
  }),
  /** Right column: dynamic legend + scroll-step sentinels (second track of `corridorMapShell`). */
  corridorMapRight1: /** @type {const} */ ({
    id: "corridor-map-right-1",
    variant: "100",
    measure: "content",
    sectionId: "corridor-map",
    label: "Corridor legend + steps",
  }),
  pullQuote: /** @type {const} */ ({
    id: "storyline-quote-1",
    variant: "100",
    measure: "content",
    sectionId: "pull-quote",
    label: "Pull quote",
  }),
  personaAfter: /** @type {const} */ ({
    id: "storyline-persona-2",
    variant: "100",
    measure: "content",
    sectionId: "persona-after",
    label: "Persona card pair (after)",
  }),
  tripPurposeChapter: /** @type {const} */ ({
    id: "trip-purpose-chapter-1",
    variant: "100",
    measure: "content",
    sectionId: "trip-purpose",
    label: "Trip purpose chapter shell",
  }),
  equityDotMap: /** @type {const} */ ({
    id: "equity-dot-map-1",
    variant: "100",
    measure: "content",
    sectionId: "equity-dot-map",
    label: "Equity dot map",
  }),
};

/** `TripPurposeProxy` — legend full width, then 25% label / 75% dots per route. */
export const tripPurposeStructure = {
  legendRow: /** @type {const} */ ({
    id: "trip-purpose-legend-1",
    variant: "100",
    measure: "content",
    sectionId: "trip-purpose",
    label: "Industry legend row",
  }),
  routeVisRow: /** @type {const} */ ({
    id: "trip-purpose-vis-1",
    variant: "25-75",
    measure: "content",
    sectionId: "trip-purpose",
    label: "Route label | dot pictogram",
  }),
};

/** Abstract two-route demographics (`ScrollDemographics.jsx` shell). */
export const scrollDemographicsStructure = {
  shell: /** @type {const} */ ({
    id: "demographics-scroll-shell-1",
    variant: "75-25",
    measure: "content",
    sectionId: null,
    label: "Abstract corridor viz + steps",
  }),
};

/** `/demographics-section` page bands. */
export const demographicsPageStructure = {
  navRow: /** @type {const} */ ({
    id: "demographics-page-nav-1",
    variant: "100",
    measure: "content",
    sectionId: null,
    label: "Back to story",
  }),
  bodyRow: /** @type {const} */ ({
    id: "demographics-page-body-1",
    variant: "100",
    measure: "content",
    sectionId: null,
    label: "Scroll demographics body",
  }),
};

/** Ordered semantic ids for the main story path (excluding home intro). */
export const fullStoryLayoutIdOrder = [
  storyExperienceStructure.storyOpening.id,
  storyExperienceStructure.personaBefore.id,
  storyExperienceStructure.fy26Plan.id,
  storyExperienceStructure.corridorMapShell.id,
  storyExperienceStructure.corridorMapVis1.id,
  storyExperienceStructure.corridorMapRight1.id,
  storyExperienceStructure.pullQuote.id,
  storyExperienceStructure.personaAfter.id,
  storyExperienceStructure.tripPurposeChapter.id,
  tripPurposeStructure.legendRow.id,
  tripPurposeStructure.routeVisRow.id,
  storyExperienceStructure.equityDotMap.id,
];
