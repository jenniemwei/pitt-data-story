/**
 * Story route filter for the dot map — from `routes_before_street` or `routes_before`
 * in `fy26_route_n_profiles_all.csv`.
 */

import { normalizeRouteId } from "../constants";

const ROUTE_VIEW_IDS = ["26", "71B"];

function routeListIncludesAny(routeListStr, ids) {
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
  return routeListIncludesAny(routeList, ROUTE_VIEW_IDS) ? 1 : 0;
}
