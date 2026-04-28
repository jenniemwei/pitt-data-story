import Papa from "papaparse";
import { dataAssetUrl } from "./dataAssetUrl";
import { POVERTY_HIGH_THRESHOLD } from "./equity-map/constants";

/**
 * Verified against `data/route_status_official.csv` (Apr 2026).
 *
 * Tiers use `pct_below_poverty_line_residents` normalized to 0–1:
 * - high: ≥ {@link POVERTY_HIGH_THRESHOLD} (20%+)
 * - low:  &lt; 20%
 */

const STATUS_CSV = "route_status_official.csv";

let routesPromise = null;

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePovertyToRatio(raw) {
  const n = toNumber(raw);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function normalizeStatus(row) {
  const status = String(row.route_status || "").trim().toLowerCase();
  if (status === "eliminated") return "eliminated";
  if (status === "reduced") return "reduced";
  return "unchanged";
}

function isMajorReduced(row) {
  const status = normalizeStatus(row);
  if (status !== "reduced") return false;
  const tier = String(row.reduction_tier || "").trim().toLowerCase();
  return tier.includes("major");
}

function povertyTier(povertyPct) {
  if (!Number.isFinite(povertyPct)) return null;
  if (povertyPct >= POVERTY_HIGH_THRESHOLD) return "high";
  return "low";
}

async function fetchCsv(filename) {
  const res = await fetch(dataAssetUrl(filename));
  if (!res.ok) {
    throw new Error(`Failed to load ${filename}`);
  }
  const text = await res.text();
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

async function getStatusRows() {
  if (!routesPromise) {
    routesPromise = fetchCsv(STATUS_CSV);
  }
  return routesPromise;
}

async function getAllRoutes() {
  const rows = await getStatusRows();
  return rows.map((row) => {
    const baselineRiders = toNumber(row.weekday_avg_riders_baseline_2017_2019);
    const recentRiders = toNumber(row.weekday_avg_riders_recent_2023_2024);
    const povertyPct = normalizePovertyToRatio(row.pct_below_poverty_line_residents);
    return {
      routeId: String(row.route_code || row.route_label || "").trim(),
      routeLabel: String(row.route_label || row.route_code || "").trim(),
      scheduleName: String(row.schedule_name || "").trim(),
      status: normalizeStatus(row),
      reductionTier: String(row.reduction_tier || "").trim().toLowerCase(),
      isMajorReduced: isMajorReduced(row),
      povertyPct,
      baselineRiders,
      recentRiders,
    };
  });
}

/**
 * Per-route recovery rows.
 * recoveryPct = (recent / baseline) - 1
 */
export async function getRouteRecovery() {
  const routes = await getAllRoutes();
  return routes
    .filter((r) => Number.isFinite(r.baselineRiders) && r.baselineRiders > 0 && Number.isFinite(r.recentRiders))
    .map((r) => ({
      routeId: r.routeId,
      status: r.status,
      povertyPct: r.povertyPct,
      recoveryPct: r.recoveryPct ?? (r.recentRiders / r.baselineRiders) - 1,
      recentRiders: r.recentRiders,
      baselineRiders: r.baselineRiders,
      isMajorReduced: r.isMajorReduced,
    }));
}

/** Fixed scale for COVID dot viz: one dot represents this many summed weekday riders. */
export const RIDERS_PER_DOT = 1000;

/**
 * Sums weekday riders (baseline vs recent) by route poverty tier for dot-bar viz.
 * `beforeDots` = round(baselineSum / RIDERS_PER_DOT), `afterDots` = round(recentSum / RIDERS_PER_DOT)
 * (same scale, 1 dot ≈ 1k riders).
 */
export async function getRidershipTotalsByPovertyTier() {
  const rows = await getRouteRecovery();
  /** @type {const} */ const tierKeys = ["high", "low"];
  const sums = {};
  for (const tier of tierKeys) {
    const tierRows = rows.filter((r) => povertyTier(r.povertyPct) === tier);
    sums[tier] = {
      tierRows,
      baselineSum: tierRows.reduce((s, r) => s + r.baselineRiders, 0),
      recentSum: tierRows.reduce((s, r) => s + r.recentRiders, 0),
    };
  }
  const maxBaseline = Math.max(sums.high.baselineSum, sums.low.baselineSum, 1);

  const out = {
    scale: {
      ridersPerDot: RIDERS_PER_DOT,
      maxBaselineAcrossTiers: maxBaseline,
    },
  };

  for (const tier of tierKeys) {
    const { tierRows, baselineSum, recentSum } = sums[tier];
    const ratio =
      baselineSum > 0 && Number.isFinite(recentSum) ? recentSum / baselineSum : 0;
    const beforeDots = Math.max(0, Math.round(baselineSum / RIDERS_PER_DOT));
    const afterDots = Math.max(0, Math.round(recentSum / RIDERS_PER_DOT));
    out[tier] = {
      routeCount: tierRows.length,
      baselineSum,
      recentSum,
      recoveryRatio: ratio,
      recoveryPct: ratio > 0 ? (ratio - 1) * 100 : null,
      beforeDots,
      afterDots,
    };
  }
  return out;
}

/**
 * FY26 eliminated or reduced routes, grouped by the same anchor poverty tiers as
 * `getRidershipTotalsByPovertyTier`. Rows without a valid poverty bucket are omitted.
 *
 * @returns {Promise<Record<"high"|"low", { routeId: string; routeLabel: string; scheduleName: string; statusLabel: string }[]>>}
 */
export async function getCutRoutesByPovertyTier() {
  const routes = await getAllRoutes();
  /** @type {Record<"high"|"low", { routeId: string; routeLabel: string; scheduleName: string; statusLabel: string }[]>} */
  const out = { high: [], low: [] };

  for (const r of routes) {
    if (r.status !== "eliminated" && r.status !== "reduced") continue;
    const tier = povertyTier(r.povertyPct);
    if (tier !== "high" && tier !== "low") continue;

    let statusLabel = "—";
    if (r.status === "eliminated") statusLabel = "Eliminated";
    else if (r.status === "reduced") {
      const rt = r.reductionTier || "";
      if (rt.includes("major")) statusLabel = "Reduced (major)";
      else if (rt.includes("minor")) statusLabel = "Reduced (minor)";
      else statusLabel = "Reduced";
    }

    out[tier].push({
      routeId: r.routeId,
      routeLabel: r.routeLabel,
      scheduleName: r.scheduleName || "—",
      statusLabel,
    });
  }

  const sortFn = (a, b) =>
    String(a.routeId).localeCompare(String(b.routeId), undefined, { numeric: true, sensitivity: "base" });
  for (const t of /** @type {const} */ (["high", "low"])) {
    out[t].sort(sortFn);
  }
  return out;
}

