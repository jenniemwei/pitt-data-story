/**
 * Layout metadata for scroll viz / demographics pages (`data-layout-id`).
 */

/**
 * @typedef {{
 *   id: string;
 *   sectionId?: string | null;
 *   label: string;
 * }} LayoutRowDef
 */

/** Abstract two-route demographics (`ScrollDemographics.jsx` shell). */
export const scrollDemographicsStructure = {
  shell: /** @type {const} */ ({
    id: "demographics-scroll-shell-1",
    sectionId: null,
    label: "Abstract corridor viz + steps",
  }),
};

/** `/demographics-section` page bands. */
export const demographicsPageStructure = {
  navRow: /** @type {const} */ ({
    id: "demographics-page-nav-1",
    sectionId: null,
    label: "Back to home",
  }),
  bodyRow: /** @type {const} */ ({
    id: "demographics-page-body-1",
    sectionId: null,
    label: "Scroll demographics body",
  }),
};
