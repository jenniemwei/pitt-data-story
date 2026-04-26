/**
 * Layout registry: semantic `id` + `GalleryRow` variant / measure.
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
    label: "Back to home",
  }),
  bodyRow: /** @type {const} */ ({
    id: "demographics-page-body-1",
    variant: "100",
    measure: "content",
    sectionId: null,
    label: "Scroll demographics body",
  }),
};
