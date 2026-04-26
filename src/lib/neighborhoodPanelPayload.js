import { normalizeRouteId } from "./equity-map/constants";

export function normHoodKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

/** Primary ACS from display CSV, optional n_profiles neighborhood rows overlay. */
export function mergeDisplayAndNProfiles(displayRows, nProfileNeighborhoodRows) {
  const map = new Map();
  for (const row of displayRows) {
    const hood = normHoodKey(row.neighborhood_group);
    if (!hood) continue;
    map.set(hood, { ...row });
  }
  for (const row of nProfileNeighborhoodRows) {
    const hood = normHoodKey(row.neighborhood_group);
    if (!hood) continue;
    const prev = map.get(hood) || {};
    map.set(hood, { ...prev, ...row });
  }
  return map;
}

export function pickProfile(profilesByHood, neighborhoodName) {
  const key = normHoodKey(neighborhoodName);
  return profilesByHood.get(key) || null;
}

export function parseRouteList(raw) {
  return String(raw || "")
    .split(";")
    .map((part) => normalizeRouteId(part))
    .filter(Boolean);
}

export function normalizeStatus(raw) {
  const status = String(raw || "").trim().toLowerCase();
  if (status === "eliminated") return "eliminated";
  if (status === "reduced") return "reduced";
  return "unchanged";
}

/** Per-route proportional loss for FY26 (elimination = 1; major reduction = 0.5; minor = 0.3). */
export function lossWeightForRoute(status, reductionTier) {
  if (status === "eliminated") return 1;
  if (status === "reduced") {
    const tier = String(reductionTier || "").trim().toLowerCase();
    if (tier.includes("minor")) return 0.3;
    if (tier.includes("major")) return 0.5;
    return 0.2;
  }
  return 0;
}

/**
 * @param {object} p
 * @param {Map} profilesByHood
 * @returns {{
 *   neighborhood: string; lostCoverage: number; beforeCount: number; afterCount: number;
 *   beforeRoutes: string[]; afterRoutes: string[]; afterRouteItems: { id: string; status: string }[];
 *   profile: object | null
 * }}
 */
export function buildHoverPayload(p, profilesByHood) {
  const neighborhood = String(p.neighborhood_name || p.hood || "Unknown");
  const profile = pickProfile(profilesByHood, neighborhood);
  const beforeRoutes = String(p.routes_before_csv || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const afterRoutes = String(p.routes_after_csv || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  /** @type {Record<string, string> | null} */
  let statusByRoute = null;
  if (p.routes_after_status_json) {
    try {
      statusByRoute = JSON.parse(String(p.routes_after_status_json));
    } catch {
      statusByRoute = null;
    }
  }
  const afterRouteItems = afterRoutes.map((id) => {
    const raw = statusByRoute && typeof statusByRoute === "object" ? statusByRoute[id] : null;
    return { id, status: normalizeStatus(raw) };
  });
  return {
    neighborhood,
    lostCoverage: Number(p.lost_coverage ?? 0),
    beforeCount: Number(p.routes_before_count || 0),
    afterCount: Number(p.routes_after_count || 0),
    beforeRoutes,
    afterRoutes,
    afterRouteItems,
    profile,
  };
}

/**
 * Same route / loss math as coverage map enrichment, for a neighborhood's `routes_before` set.
 *
 * @param {string} neighborhood
 * @param {Set<string>} routesSet
 * @param {Map<string, string>} statusByRoute
 * @param {Map<string, unknown>} reductionTierByRoute
 */
export function computeNeighborhoodRouteStats(neighborhood, routesSet, statusByRoute, reductionTierByRoute) {
  const total = routesSet.size;
  let lossSum = 0;
  for (const routeId of routesSet) {
    const st = statusByRoute.get(routeId) || "unchanged";
    lossSum += lossWeightForRoute(st, reductionTierByRoute.get(routeId));
  }
  const lostCoverage = total > 0 ? Math.max(0, Math.min(1, lossSum / total)) : 0;
  const beforeRoutes = Array.from(routesSet).sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }),
  );
  const afterRoutes = beforeRoutes.filter((routeId) => (statusByRoute.get(routeId) || "unchanged") !== "eliminated");
  const afterStatusById = Object.fromEntries(
    afterRoutes.map((r) => [r, statusByRoute.get(r) || "unchanged"]),
  );

  return {
    neighborhood_name: neighborhood,
    lost_coverage: lostCoverage,
    routes_before_csv: beforeRoutes.join(", "),
    routes_after_csv: afterRoutes.join(", "),
    routes_after_count: afterRoutes.length,
    routes_after_status_json: JSON.stringify(afterStatusById),
    routes_before_count: beforeRoutes.length,
  };
}

export function buildHoverPayloadForNeighborhoodName(
  neighborhoodName,
  routesByNeighborhood,
  statusByRoute,
  reductionTierByRoute,
  profilesByHood,
) {
  const n = String(neighborhoodName || "").trim();
  const routes = routesByNeighborhood.get(n) || new Set();
  const props = computeNeighborhoodRouteStats(n, routes, statusByRoute, reductionTierByRoute);
  return buildHoverPayload(props, profilesByHood);
}
