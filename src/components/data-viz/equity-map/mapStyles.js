/**
 * Equity map — Mapbox paint colors, tokens, and style fragments.
 * UI-only styles live in `EquityMap.module.css` + `app/globals.css` (e.g. `--equity-map-line-*`).
 */

// =============================================================================
// Neighborhood type fills (`hood-fill` layer + legend chips)
// =============================================================================

/** Low vulnerability (V < 40). */
export const V_FILL_LOW = "#EEEAE1";
/** Moderate vulnerability (40–59). */
export const V_FILL_MOD = "#FFA883";
/** High vulnerability (V ≥ 60). */
export const V_FILL_HIGH = "#FF6B6B";
/** Water-only block groups in source. */
export const WATER_FILL = "#999999";

/** Uniform alpha for neighborhood polygons over basemap. */
export const HOOD_FILL_OPACITY = 0.92;

/** Full paint spec: V bands, water exception, shared fill opacity. */
export const HOOD_FILL_PAINT = {
  "fill-color": [
    "case",
    ["==", ["get", "is_water"], 1],
    WATER_FILL,
    [">=", ["get", "v_score"], 60],
    V_FILL_HIGH,
    [">=", ["get", "v_score"], 40],
    V_FILL_MOD,
    V_FILL_LOW,
  ],
  "fill-opacity": HOOD_FILL_OPACITY,
};

// =============================================================================
// Neighborhood outlines (interaction only — no default boundary)
// =============================================================================

export const HOOD_FEATURED_OUTLINE_PAINT = {
  "line-color": "#2c7be5",
  "line-width": 1.3,
  "line-opacity": 0.9,
};

export const HOOD_HOVER_OUTLINE_PAINT = {
  "line-color": "#111",
  "line-width": 1.3,
};

// =============================================================================
// Route categories (`route_visual` on GeoJSON features)
// =============================================================================

export const ROUTE_VISUAL = {
  existing: "existing",
  stop_reduction: "stop_reduction",
  hours_stop_reduction: "hours_stop_reduction",
  hours_reduction: "hours_reduction",
  elimination: "elimination",
};

/** After cuts — routes with no FY26 change (solid black). */
export const ROUTE_NO_CHANGE_BLACK = "#111111";
/** After cuts — reduced (default / unspecified subtype); medium grey solid. */
export const ROUTE_REDUCED_MEDIUM_GREY = "#8f8f8f";
/** Reduced — major frequency / stop changes (darker grey band). */
export const ROUTE_REDUCED_DARK_GREY = "#5c5c5c";
/** Reduced — span / hours only. */
export const ROUTE_REDUCED_MID_GREY = "#767676";
/** Reduced — alignment + hours combined. */
export const ROUTE_REDUCED_STONE_GREY = "#686868";
/** After cuts — eliminated; light grey under other layers. */
export const ROUTE_ELIMINATED_LIGHT_GREY = "#d6d6d6";

/** Before-cuts network only — distinct from “after” styling. */
export const ROUTE_NO_IMPACT_BLUE = "#1D7B96";

/** @deprecated Use ROUTE_NO_CHANGE_BLACK / ROUTE_REDUCED_MEDIUM_GREY; kept for external imports. */
export const ROUTE_REDUCED_BLACK = "#000000";
/** @deprecated Reduced routes now use solid medium grey. */
export const ROUTE_LINE_OPACITY = 1;
/** @deprecated Simple mode uses full-opacity medium grey. */
export const SIMPLE_REDUCED_OPACITY = 1;

// =============================================================================
// Route line styles — elimination (`routes-after-eliminated`, under others)
// =============================================================================

/** @deprecated Use ROUTE_ELIMINATED_LIGHT_GREY */
export const ROUTE_ELIMINATION_STROKE = ROUTE_ELIMINATED_LIGHT_GREY;

export const ROUTES_ELIMINATED_PAINT = {
  "line-color": ROUTE_ELIMINATED_LIGHT_GREY,
  "line-width": 2,
  "line-opacity": 1,
  "line-dasharray": [1, 0],
};

// =============================================================================
// Route line styles — before cuts (`routes-before`)
// =============================================================================

export const ROUTES_BEFORE_PAINT = {
  "line-color": ROUTE_NO_IMPACT_BLUE,
  "line-width": 2,
  "line-opacity": 1,
  "line-dasharray": [1, 0],
};

// =============================================================================
// Route line styles — after cuts, non-eliminated (`toggle` detailed vs simple)
// =============================================================================

/**
 * Detailed after-cuts: no-change black; reduced subtypes as distinct grey solids (no dashes).
 */
export const ROUTES_AFTER_DETAILED_PAINT = {
  "line-color": [
    "match",
    ["get", "route_visual"],
    ROUTE_VISUAL.existing,
    ROUTE_NO_CHANGE_BLACK,
    ROUTE_VISUAL.stop_reduction,
    ROUTE_REDUCED_DARK_GREY,
    ROUTE_VISUAL.hours_reduction,
    ROUTE_REDUCED_MID_GREY,
    ROUTE_VISUAL.hours_stop_reduction,
    ROUTE_REDUCED_STONE_GREY,
    ROUTE_REDUCED_MEDIUM_GREY,
  ],
  "line-opacity": 1,
  "line-width": 2,
  "line-dasharray": [1, 0],
};

/** Simple: no-change black vs one medium grey for any reduction (solid). */
export const ROUTES_AFTER_SIMPLE_PAINT = {
  "line-color": [
    "match",
    ["get", "route_visual"],
    ROUTE_VISUAL.existing,
    ROUTE_NO_CHANGE_BLACK,
    ROUTE_REDUCED_MEDIUM_GREY,
  ],
  "line-opacity": 1,
  "line-width": 2,
  "line-dasharray": [1, 0],
};

// =============================================================================
// Basemap & camera defaults
// =============================================================================

export const MAP_BASEMAP_COLOR = "#f6f6f4";

/** Minimal GL style: flat background only. */
export const FLAT_BASEMAP_STYLE = /** @type {const} */ ({
  version: 8,
  name: "equity-flat",
  metadata: { "mapbox:autocomposite": false },
  sources: {},
  layers: [
    {
      id: "basemap-flat",
      type: "background",
      paint: { "background-color": MAP_BASEMAP_COLOR },
    },
  ],
});

export const MAP_INITIAL_ZOOM = 10.1;
export const MAP_CENTER = /** @type {const} */ ([-79.9959, 40.4406]);
