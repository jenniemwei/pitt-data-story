/** Neighborhood grouping helpers for coverage/route maps. */

import { buffer, cleanCoords, featureCollection, simplify, union as turfUnion } from "@turf/turf";

/** Manual aliases where a non-standard hood label must map to a known group key. */
export const HOOD_TO_GROUP_NAME_ALIASES = {};

const PROFILE_SIGNATURE_FIELDS = [
  "total_pop",
  "share_below_50pct_poverty_threshold",
  "share_below_100pct_poverty_threshold",
  "share_below_100pct_poverty_25plus",
  "share_commute_car_truck_van",
  "share_commute_public_transit",
  "share_commute_bicycle",
  "share_commute_walked",
  "share_commute_other_modes",
  "share_commute_worked_from_home",
  "share_hh_income_100k_to_199k",
  "share_hh_income_200k_plus",
];

function canonLabel(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function decomposeGroupLabel(label, hoodCanonPairs) {
  const target = canonLabel(label);
  if (!target) return [];
  /** @type {Map<number, string[] | null>} */
  const memo = new Map();
  function dfs(idx) {
    if (idx === target.length) return [];
    if (memo.has(idx)) return memo.get(idx);
    for (const [hood, hc] of hoodCanonPairs) {
      if (!hc || !target.startsWith(hc, idx)) continue;
      const tail = dfs(idx + hc.length);
      if (tail) {
        const ans = [hood, ...tail];
        memo.set(idx, ans);
        return ans;
      }
    }
    memo.set(idx, null);
    return null;
  }
  return dfs(0) || [];
}

/**
 * Build hood→display-group mapping directly from display profile labels.
 * If a display label matches a hood exactly, it stays standalone.
 * If it is hyphenated/grouped, map every decomposed hood member to that label.
 * @param {object[]} displayRows
 * @param {Set<string>} hoodSet
 * @returns {Map<string, string>} hood name → display label
 */
export function buildHoodToGroupNameMap(displayRows = [], hoodSet = new Set()) {
  const byHood = new Map();
  for (const hood of hoodSet) byHood.set(hood, hood);

  const hoodCanonPairs = Array.from(hoodSet)
    .map((hood) => [hood, canonLabel(hood)])
    .sort((a, b) => b[1].length - a[1].length);

  /** Prefer explicit CSV row mapping: neighborhood_group (member hood) -> profile_neighborhood_group (display label). */
  for (const row of displayRows) {
    const hoodName = String(row.neighborhood_group || "").trim();
    const profileLabel = String(row.profile_neighborhood_group || "").trim();
    if (!hoodName || !profileLabel) continue;
    if (hoodSet.has(hoodName) && hoodName !== profileLabel) {
      byHood.set(hoodName, profileLabel);
    }
  }

  for (const row of displayRows) {
    const label = String(row.neighborhood_group || "").trim();
    if (!label) continue;
    if (hoodSet.has(label)) {
      byHood.set(label, label);
      continue;
    }
    const members = decomposeGroupLabel(label, hoodCanonPairs);
    if (members.length >= 2) {
      for (const hood of members) byHood.set(hood, label);
    }
  }

  /**
   * Auto-group any hood rows that share an exact profile signature (population + demographics),
   * even if their display label is not a decomposable concatenation.
   */
  const rowsBySignature = new Map();
  for (const row of displayRows) {
    const hoodName = String(row.neighborhood_group || "").trim();
    if (!hoodSet.has(hoodName)) continue;
    const signature = PROFILE_SIGNATURE_FIELDS.map((k) => String(row?.[k] ?? "").trim()).join("|");
    if (!signature) continue;
    if (!rowsBySignature.has(signature)) rowsBySignature.set(signature, []);
    rowsBySignature.get(signature).push(row);
  }
  for (const rows of rowsBySignature.values()) {
    const memberHoods = Array.from(
      new Set(
        rows
          .map((r) => String(r.neighborhood_group || "").trim())
          .filter((n) => hoodSet.has(n)),
      ),
    );
    if (memberHoods.length < 2) continue;
    const candidateLabels = rows
      .map((r) => String(r.profile_neighborhood_group || "").trim())
      .filter(Boolean);
    const preferred = candidateLabels.find((v) => v.includes("-")) || candidateLabels[0];
    const fallback = memberHoods.join("-");
    const groupLabel = preferred || fallback;
    for (const hood of memberHoods) byHood.set(hood, groupLabel);
  }

  for (const [h, g] of Object.entries(HOOD_TO_GROUP_NAME_ALIASES)) byHood.set(h, g);
  return byHood;
}

const MERGE_SIMPLIFY_TOLERANCE = 0.000008;
const DISSOLVE_BUFFER_METERS = 1.2;

/**
 * @param {import('geojson').Feature} f
 * @param {import('geojson').Feature | null} baseProps
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
function polishOuterBoundary(f, baseProps) {
  if (!f?.geometry) return f;
  let next = f;
  const g0 = f.geometry;
  if (g0.type === "Polygon" && g0.coordinates[0].length > 200) {
    const simp = simplify(f, { tolerance: MERGE_SIMPLIFY_TOLERANCE, highQuality: true });
    if (simp?.geometry) next = /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (simp);
  }
  const g = next.geometry;
  if (g.type === "MultiPolygon" && g.coordinates.length > 1) {
    const dissolved = tryDissolveWithBuffer(next);
    if (dissolved) return wrapWithProps(dissolved, baseProps);
  }
  return wrapWithProps(next, baseProps);
}

/**
 * @param {import('geojson').Feature} f
 * @param {import('geojson').Feature | null} baseProps
 */
function wrapWithProps(f, baseProps) {
  return {
    type: "Feature",
    properties: baseProps?.properties != null ? baseProps.properties : f.properties || {},
    geometry: f.geometry,
  };
}

/**
 * @param {import('geojson').Feature<import('geojson').MultiPolygon> | import('geojson').Feature<import('geojson').Polygon>} f
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
function tryDissolveWithBuffer(f) {
  const g = f.geometry;
  if (g.type === "MultiPolygon" && g.coordinates.length < 2) return null;
  try {
    const m = buffer(f, DISSOLVE_BUFFER_METERS, { units: "meters" });
    if (!m?.geometry) return null;
    const m2 = buffer(m, -DISSOLVE_BUFFER_METERS, { units: "meters" });
    if (m2?.geometry?.type === "Polygon" || m2?.geometry?.type === "MultiPolygon") return m2;
  } catch {
    /* keep original */
  }
  return null;
}

/**
 * @param {import('geojson').Polygon|import('geojson').MultiPolygon} geometry
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
function unionAllPolygonParts(geometry) {
  if (geometry.type === "Polygon") {
    return { type: "Feature", properties: {}, geometry };
  }
  if (geometry.type !== "MultiPolygon" || geometry.coordinates.length === 0) return null;
  if (geometry.coordinates.length === 1) {
    return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: geometry.coordinates[0] } };
  }
  const polyFeatures = geometry.coordinates.map((coords) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: coords },
  }));
  const fc = featureCollection(polyFeatures);
  let out = null;
  try {
    out = turfUnion(fc);
  } catch {
    out = null;
  }
  if (out?.geometry) return out;
  return mergePolygonPairwise(fc);
}

/**
 * @param {import('geojson').Feature} f
 * @param {import('geojson').Feature | null} baseProps
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
function unionMultiShellResult(f, baseProps) {
  if (!f?.geometry) return f;
  if (f.geometry.type !== "MultiPolygon" || f.geometry.coordinates.length < 2) return f;
  const asPolys = f.geometry.coordinates.map((c) => ({
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: c },
  }));
  const fc = featureCollection(asPolys);
  let merged = null;
  try {
    merged = turfUnion(fc);
  } catch {
    merged = null;
  }
  if (merged?.geometry) {
    if (merged.geometry.type === "Polygon") return wrapWithProps(merged, baseProps);
    if (merged.geometry.type === "MultiPolygon" && merged.geometry.coordinates.length < f.geometry.coordinates.length) {
      return wrapWithProps(merged, baseProps);
    }
  }
  const byPair = mergePolygonPairwise(featureCollection(asPolys));
  if (byPair?.geometry) return wrapWithProps(byPair, baseProps);
  return f;
}

/**
 * @param {import('geojson').FeatureCollection<import('geojson').Polygon|import('geojson').MultiPolygon>} fc
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
function mergePolygonPairwise(fc) {
  const feats = fc.features;
  if (feats.length === 0) return null;
  if (feats.length === 1) return /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (feats[0]);
  let acc = /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null} */ (feats[0]);
  for (let i = 1; i < feats.length; i += 1) {
    if (!acc) return null;
    const pair = featureCollection([acc, feats[i]]);
    try {
      const u = turfUnion(pair);
      if (u?.geometry) acc = /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (u);
    } catch {
      return acc;
    }
  }
  return acc;
}

/**
 * Union polygon geometries; removes shared boundaries for adjacent parts.
 * @param {import('geojson').Feature[]} features
 * @returns {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon> | null}
 */
export function mergePolygonFeaturesForGroup(features) {
  if (features.length === 0) return null;
  const base = features[0];
  if (features.length === 1) {
    const g0 = base.geometry;
    if (!g0) return null;
    if (g0.type === "MultiPolygon" && g0.coordinates.length > 1) {
      const u = unionAllPolygonParts(g0);
      if (u) {
        const v = unionMultiShellResult(u, base);
        return polishOuterBoundary(v, base);
      }
    }
    const f = { type: "Feature", properties: base.properties || {}, geometry: g0 };
    return polishOuterBoundary(/** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (f), base);
  }
  const cleaned = features.map((f) => {
    const g = f.geometry;
    if (!g) return f;
    const clone =
      g.type === "Polygon" || g.type === "MultiPolygon" ? { ...g, coordinates: g.coordinates } : g;
    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      try {
        const cc = cleanCoords(clone, { mutate: true });
        return { ...f, geometry: /** @type {import('geojson').Polygon|import('geojson').MultiPolygon} */ (cc) };
      } catch {
        return f;
      }
    }
    return f;
  });
  const fc = featureCollection(
    cleaned.map((f) => ({
      type: "Feature",
      properties: {},
      geometry: f.geometry,
    })),
  );
  let merged = null;
  try {
    merged = turfUnion(fc);
  } catch {
    merged = null;
  }
  if (!merged?.geometry) {
    try {
      merged = mergePolygonPairwise(fc);
    } catch {
      merged = null;
    }
  }
  if (merged?.geometry) {
    let out = /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (merged);
    if (out.geometry.type === "MultiPolygon" && out.geometry.coordinates.length > 1) {
      out = /** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (
        unionMultiShellResult(out, null) || out
      );
    }
    return polishOuterBoundary(out, base);
  }
  const polyParts = [];
  for (const f of cleaned) {
    const g = f.geometry;
    if (g.type === "Polygon") polyParts.push(g.coordinates);
    else if (g.type === "MultiPolygon") {
      for (const c of g.coordinates) polyParts.push(c);
    }
  }
  if (polyParts.length === 0) return null;
  const lastTry = mergePolygonPairwise(
    featureCollection(
      polyParts.map((coords) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: coords },
      })),
    ),
  );
  if (lastTry?.geometry) {
    return polishOuterBoundary(/** @type {import('geojson').Feature<import('geojson').Polygon|import('geojson').MultiPolygon>} */ (lastTry), base);
  }
  return {
    type: "Feature",
    properties: base.properties || {},
    geometry: { type: "MultiPolygon", coordinates: polyParts },
  };
}

/**
 * @param {import('geojson').Feature[]} enrichedFeatures
 * @param {Map<string, string>} hoodToGroup
 * @returns {import('geojson').Feature[]}
 */
export function buildGroupedCoverageFeatures(enrichedFeatures, hoodToGroup) {
  /** @type {Map<string, { groupName: string; list: import('geojson').Feature[] }>} */
  const buckets = new Map();

  for (const f of enrichedFeatures) {
    const hood = String(f.properties?.hood || "").trim();
    if (!hood) continue;
    const group = hoodToGroup.get(hood);
    const key = group ? `g:${group}` : `h:${hood}`;
    const groupName = group || hood;
    if (!buckets.has(key)) {
      buckets.set(key, { groupName, list: [] });
    }
    buckets.get(key).list.push(f);
  }

  /** @type {import('geojson').Feature[]} */
  const out = [];
  for (const { groupName, list } of buckets.values()) {
    const first = list[0];
    const baseProps = { ...first.properties };
    const merged = mergePolygonFeaturesForGroup(list);
    if (!merged) continue;
    const routeSetBefore = new Set();
    const routeSetAfter = new Set();
    /** @type {Record<string, string>} */
    const routeStatusById = {};
    let totalBeforeCount = 0;
    let totalAfterCount = 0;
    let lostCoverageWeightedSum = 0;
    for (const feature of list) {
      const props = feature?.properties || {};
      const beforeCsv = String(props.routes_before_csv || "");
      const afterCsv = String(props.routes_after_csv || "");
      const beforeList = beforeCsv
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const afterList = afterCsv
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      for (const routeId of beforeList) routeSetBefore.add(routeId);
      for (const routeId of afterList) routeSetAfter.add(routeId);
      const afterStatusRaw = String(props.routes_after_status_json || "{}");
      try {
        const parsed = JSON.parse(afterStatusRaw);
        if (parsed && typeof parsed === "object") {
          for (const [routeId, status] of Object.entries(parsed)) {
            if (routeId) routeStatusById[routeId] = String(status || "unchanged");
          }
        }
      } catch {
        /* ignore malformed rows */
      }
      const beforeCount = Number(props.routes_before_count) || beforeList.length;
      const afterCount = Number(props.routes_after_count) || afterList.length;
      totalBeforeCount += beforeCount;
      totalAfterCount += afterCount;
      const loss = Number(props.lost_coverage) || 0;
      lostCoverageWeightedSum += loss * beforeCount;
    }
    const routesBeforeCount = routeSetBefore.size > 0 ? routeSetBefore.size : totalBeforeCount;
    const routesAfterCount = routeSetAfter.size > 0 ? routeSetAfter.size : totalAfterCount;
    // `lostCoverageWeightedSum` is built as Σ(memberLostCoverage * memberBeforeCount),
    // so the matching denominator is Σ(memberBeforeCount), not unique route IDs.
    // Using unique route count here can overstate loss (often clipping to 1.0) when
    // grouped neighborhoods share many of the same routes.
    const lostCoverageDenominator = totalBeforeCount > 0 ? totalBeforeCount : routesBeforeCount;
    const lostCoverage = lostCoverageDenominator > 0
      ? Math.max(0, Math.min(1, lostCoverageWeightedSum / lostCoverageDenominator))
      : 0;
    out.push({
      type: "Feature",
      geometry: merged.geometry,
      properties: {
        ...baseProps,
        neighborhood_name: groupName,
        group_display_name: groupName,
        member_hood_count: list.length,
        lost_coverage: lostCoverage,
        routes_before_csv: Array.from(routeSetBefore).sort((a, b) =>
          String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }),
        ).join(", "),
        routes_after_csv: Array.from(routeSetAfter).sort((a, b) =>
          String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" }),
        ).join(", "),
        routes_after_status_json: JSON.stringify(routeStatusById),
        routes_before_count: routesBeforeCount,
        routes_after_count: routesAfterCount,
      },
    });
  }
  return out;
}

/**
 * @param {Map<string, Set<string>>} routesByNeighborhood
 * @param {Map<string, string>} hoodToGroup
 */
export function addGroupKeysToRoutesMap(routesByNeighborhood, hoodToGroup) {
  /** @type {Map<string, Set<string>>} */
  const groupToMembers = new Map();
  for (const [hood, g] of hoodToGroup) {
    if (!groupToMembers.has(g)) groupToMembers.set(g, new Set());
    groupToMembers.get(g).add(hood);
  }
  for (const [g, members] of groupToMembers) {
    const merged = new Set();
    for (const h of members) {
      const s = routesByNeighborhood.get(h);
      if (s) for (const r of s) merged.add(r);
    }
    if (merged.size) routesByNeighborhood.set(g, merged);
  }
}

/**
 * Average of member centroids (for one schematic point per `neighborhood group`).
 * @param {string[]} members
 * @param {Map<string, [number, number]>} centroids
 * @returns {[number, number] | null}
 */
function averageMemberCentroid(members, centroids) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const h of members) {
    const c = centroids.get(h);
    if (!c) continue;
    sx += c[0];
    sy += c[1];
    n += 1;
  }
  if (!n) return null;
  return [sx / n, sy / n];
}

/**
 * One circle per neighborhood group; standalone hoods keep one point each.
 * @param {Set<string> | Iterable<string>} hoodSet
 * @param {Map<string, [number, number]>} centroids
 * @param {Map<string, number>} popByHood
 * @param {Map<string, number>} povByHood
 * @param {Map<string, string>} hoodToGroup
 * @returns {import('geojson').Feature[]}
 */
export function buildRepresentationalGroupPointFeatures(hoodSet, centroids, popByHood, povByHood, hoodToGroup) {
  /** @type {Map<string, { name: string; members: string[] }>} */
  const buckets = new Map();
  for (const hood of hoodSet) {
    const g = hoodToGroup.get(hood);
    const key = g ? `g:${g}` : `h:${hood}`;
    if (!buckets.has(key)) {
      buckets.set(key, { name: g || hood, members: [] });
    }
    buckets.get(key).members.push(hood);
  }

  /** @type {import('geojson').Feature[]} */
  const out = [];
  for (const { name, members } of buckets.values()) {
    if (members.length === 0) continue;
    const coords = members.length === 1 ? centroids.get(members[0]) : averageMemberCentroid(members, centroids);
    if (!coords) continue;

    let bestH = members[0];
    let bestPop = 0;
    for (const h of members) {
      const p = popByHood.get(h) ?? 0;
      if (p > bestPop) {
        bestPop = p;
        bestH = h;
      }
    }
    const population = bestPop;
    const poverty = povByHood.get(bestH) ?? 0;

    out.push({
      type: "Feature",
      properties: {
        neighborhood_name: name,
        population,
        poverty,
      },
      geometry: { type: "Point", coordinates: coords },
    });
  }
  return out;
}
