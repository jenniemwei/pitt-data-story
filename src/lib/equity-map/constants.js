/**
 * ACS poverty share (below poverty line): neighborhoods/routes at or above this **ratio**
 * (e.g. `0.2` = 20%) use the “high poverty” bucket on dot maps, equity hood fill, and route-tier aggregates.
 * Values &gt; 1 in source data are treated as whole percents and divided by 100.
 */
export const POVERTY_HIGH_THRESHOLD = 0.2;

/**
 * Transit-dependence proxy on dot maps (ratio 0–1; values &gt; 1 treated as whole percent ÷ 100).
 * Below {@link TRANSIT_DOT_MIN_RATIO} the map emits **no** dot. Three size tiers; circle multipliers 1∶2∶3.
 */
export const TRANSIT_DOT_MIN_RATIO = 0.05;
export const TRANSIT_DOT_SMALL_MAX_RATIO = 0.1;
export const TRANSIT_DOT_MEDIUM_MAX_RATIO = 0.2;

export const ROUTE_ALIAS_MAP = {
  "019L": "19L",
  "051L": "51L",
  "052L": "52L",
  "053L": "53L",
  "028X": "28X",
  "061A": "61A",
  "061B": "61B",
  "061C": "61C",
  "061D": "61D",
  "071A": "71A",
  "071B": "71B",
  "071C": "71C",
  "071D": "71D",
  BLLB: "BLUE",
  BLSV: "BLUE",
  "000": "MI",
  "0": "MI",
};

export function normalizeRouteId(id) {
  const raw = String(id || "").trim().toUpperCase();
  if (!raw) return "";
  const base = /^\d+$/.test(raw) ? String(Number(raw)) : raw;
  return ROUTE_ALIAS_MAP[base] || base;
}
