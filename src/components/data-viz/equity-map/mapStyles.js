/**
 * Equity map — Mapbox paint colors, tokens, and style fragments.
 * UI-only styles live in `EquityMap.module.css` + `app/globals.css` (e.g. `--equity-map-line-*`).
 */

// =============================================================================
// Map fill ramp — keep in sync with `app/globals.css` `:root` `--color-map-*`
// (dot map land plate, poverty tertiles, corridor quartile dots / fills).
// =============================================================================

export const MAP_FILL_INACTIVE = "#EEEAE1";
export const MAP_FILL_L0 = "#BFD0AA";
export const MAP_FILL_L2 = "#FFA883";
export const MAP_FILL_L3 = "#FF6B6B";

/** Low tertile / band. */
export const POVERTY_LEVEL_FILL_LOW = MAP_FILL_L0;
/** Medium tertile / band. */
export const POVERTY_LEVEL_FILL_MID = MAP_FILL_L2;
/** High tertile / band. */
export const POVERTY_LEVEL_FILL_HIGH = MAP_FILL_L3;

/** Low → mid → high (poverty tertiles on dots; same colors on `hood-fill` composite bands). */
export const POVERTY_LEVEL_COLORS = /** @type {const} */ ([
  POVERTY_LEVEL_FILL_LOW,
  POVERTY_LEVEL_FILL_MID,
  POVERTY_LEVEL_FILL_HIGH,
]);

/** Water-only block groups in source. */
export const WATER_FILL = "#999999";

// =============================================================================
// Corridor scroll map (71B / P10) — quartile choropleth + matching dot colors
// =============================================================================

/** Hoods off the story corridor — same inactive plate as dot map region fill. */
export const CORRIDOR_OFF_CORRIDOR_MUTED = MAP_FILL_INACTIVE;

/** Quartile bins low → high on touched hoods (same for fill and full-step dots). */
export const CORRIDOR_QUARTILE_FILLS = /** @type {const} */ ([
  MAP_FILL_INACTIVE,
  MAP_FILL_L0,
  MAP_FILL_L2,
  MAP_FILL_L3,
]);

/** Neutral grey for transit-only dots (`--g4`). */
export const TRANSIT_DOT_NEUTRAL_GREY = "#86868a";

/** Uniform alpha for neighborhood polygons over basemap. */
export const HOOD_FILL_OPACITY = 0.92;

/**
 * Neighborhood fill uses integer `poverty_bucket` 0 / 1 / 2 (low / mid / high poverty tertile among land hoods).
 * Computed in `EquityMap` from ACS `below_poverty_pct`; same palette as dot-map poverty colors.
 */
export const HOOD_POVERTY_BUCKET_HIGH = 2;

/** Full paint spec: poverty tertile bands, water exception, shared fill opacity. */
export const HOOD_FILL_PAINT = {
  "fill-color": [
    "case",
    ["==", ["get", "is_water"], 1],
    WATER_FILL,
    ["==", ["to-number", ["get", "poverty_bucket"]], 2],
    POVERTY_LEVEL_FILL_HIGH,
    ["==", ["to-number", ["get", "poverty_bucket"]], 1],
    POVERTY_LEVEL_FILL_MID,
    POVERTY_LEVEL_FILL_LOW,
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

/** Flat map + “invisible” off-story hood fill — keep aligned with `app/globals.css` `--color-bg-page` / `--bg-default`. */
export const MAP_BASEMAP_COLOR = "#f7f7f7";

/** Landmass under the dot map — neighborhoods, excluding water-only features. */
export const DOT_MAP_REGION_FILL = MAP_FILL_INACTIVE;

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
