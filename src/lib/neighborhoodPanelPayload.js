import { normalizeRouteId } from "./equity-map/constants";

export function normHoodKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase();
}

/**
 * @param {Map<string, object>} map
 * @param {object} row
 * @param {string} [keyField]
 */
function putProfileByKeys(map, row, keyField = "neighborhood_group") {
  const primary = String(row[keyField] || row.neighborhood_group || "").trim();
  if (!primary) return;
  const merged = { ...row };
  const k1 = normHoodKey(primary);
  if (k1) {
    const prev = map.get(k1) || {};
    map.set(k1, { ...prev, ...merged });
  }
  const profileLabel = String(row.profile_neighborhood_group || "").trim();
  if (profileLabel) {
    const k2 = normHoodKey(profileLabel);
    if (k2 && k2 !== k1) {
      const prev2 = map.get(k2) || {};
      map.set(k2, { ...prev2, ...merged });
    }
  }
  const aliasParts = String(row.hood_aliases || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of aliasParts) {
    const ka = normHoodKey(part);
    if (!ka || ka === k1) continue;
    const k2n = profileLabel ? normHoodKey(profileLabel) : "";
    if (ka === k2n) continue;
    const preva = map.get(ka) || {};
    map.set(ka, { ...preva, ...merged });
  }
}

/** Build panel profile map from a display CSV (2024 or 2022). */
export function mergeDisplayAndNProfiles(displayRows) {
  const map = new Map();
  for (const row of displayRows) {
    putProfileByKeys(map, {
      ...row,
      // Keep explicit all-ages key so the 25+ toggle can switch poverty numerator cleanly.
      share_below_100pct_poverty_threshold_all_ages: row.share_below_100pct_poverty_threshold,
    });
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
 *   profile: object | null;
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
