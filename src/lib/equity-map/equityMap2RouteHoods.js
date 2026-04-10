/**
 * Which neighborhoods “serve” P10 / 71B for EquityMap2 route view — from `routes_before_street` or `routes_before`
 * in `fy26_route_n_profiles_all.csv` (same street-vs-all rule as other equity maps).
 */

import { normalizeRouteId } from "./constants";

export const EQUITY_MAP2_ROUTE_VIEW_IDS = ["P10", "71B"];

/**
 * @param {string} routeListStr — semicolon-separated route codes (e.g. `071B;P10`)
 * @param {string[]} ids — normalized ids to match (`71B`, `P10`)
 */
export function routeListIncludesAny(routeListStr, ids) {
  const want = new Set(ids.map((id) => normalizeRouteId(id)));
  const parts = String(routeListStr || "")
    .split(";")
    .map((s) => normalizeRouteId(s.trim()))
    .filter(Boolean);
  return parts.some((p) => want.has(p));
}

/**
 * @param {Record<string, string>} row — neighborhood profile row
 * @returns {0 | 1}
 */
export function rowServesP10Or71B(row) {
  const streetBefore = Number(row.routes_before_street_count);
  const useStreet = Number.isFinite(streetBefore) && streetBefore > 0;
  const routeList = useStreet ? row.routes_before_street || "" : row.routes_before || "";
  return routeListIncludesAny(routeList, EQUITY_MAP2_ROUTE_VIEW_IDS) ? 1 : 0;
}
