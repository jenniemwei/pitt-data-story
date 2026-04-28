import Papa from "papaparse";
import { dataAssetUrl } from "../lib/dataAssetUrl";

const STOP_ROUTE_CSV = "route_stop_per_route.csv";
const STATUS_CSV = "FY26_route_status_all.csv";

const SERVICE_SPAN_HOURS = 18;
const MIN_HEADWAY_MINUTES = 2;
const IGNORED_ROUTES = new Set(["MI", "DQI"]);
const MANUAL_ROUTE_OVERRIDES = new Map([
  [
    "79",
    {
      route_code: "079",
      route_label: "79",
      route_kind: "non_commuter_bus",
      route_status: "reduced",
      reduction_tier: "major",
      // Keep broad coverage so area filter can include this route.
      anchor_neighborhoods: "Central Business District, Waterfront, Squirrel Hill North, Shadyside",
    },
  ],
]);

let cachedDataPromise = null;

const AREA_ALIASES = {
  downtown: ["downtown", "central business district"],
  waterfront: ["waterfront", "south shore", "strip district"],
  "squirrel hill": ["squirrel hill north", "squirrel hill south", "squirrel hill"],
  shadyside: ["shadyside"],
};

function parseCsv(text, filename) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`Failed to parse ${filename}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

async function fetchCsv(filename) {
  const res = await fetch(dataAssetUrl(filename));
  if (!res.ok) {
    throw new Error(`Failed to load ${filename}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseCsv(text, filename);
}

function normalizeRouteStatus(raw) {
  const status = String(raw || "").trim().toLowerCase();
  if (status === "eliminated") return "eliminated";
  if (status === "reduced") return "reduced";
  if (status === "unaffected" || status === "unchanged") return "full";
  throw new Error(`Unknown route status "${String(raw)}" in ${STATUS_CSV}`);
}

function canonicalizeRouteId(routeId) {
  const raw = String(routeId || "").trim().toUpperCase();
  const match = raw.match(/^(\d+)([A-Z].*)?$/);
  if (!match) return raw;
  const numeric = String(Number(match[1]));
  const suffix = match[2] || "";
  return `${numeric}${suffix}`;
}

function reductionFractionFor(row) {
  const normalized = normalizeRouteStatus(row.route_status);
  if (normalized === "eliminated") return 1;
  if (normalized === "full") return 0;

  const tier = String(row.reduction_tier || "").trim().toLowerCase();
  if (tier.includes("major")) return 0.5;
  if (tier.includes("minor")) return 0.25;
  throw new Error(
    `Route ${String(row.route_code || row.route_label || "").trim()} is reduced but has unknown reduction_tier "${String(row.reduction_tier)}"`,
  );
}

function routeTypeFor(row) {
  const kind = String(row.route_kind || "").trim().toLowerCase();
  if (!kind) {
    throw new Error(`Missing route_kind for route "${String(row.route_code || row.route_label || "").trim()}"`);
  }
  return kind;
}

function toNonNegativeNumber(value, context) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Expected non-negative number for ${context}, received "${String(value)}"`);
  }
  return n;
}

function routeColorForIndex(index) {
  const tokenPalette = [
    "var(--color-line-primary)",
    "var(--color-line-secondary)",
    "var(--color-line-muted)",
    "var(--b7)",
    "var(--b8)",
    "var(--b9)",
  ];
  return tokenPalette[index % tokenPalette.length];
}

function buildIndexes(stopRouteRows, statusRows) {
  const stopById = new Map();
  const routesByStopId = new Map();
  const routeTripsByStopId = new Map();

  for (const row of stopRouteRows) {
    const stopId = String(row.stop_id || "").trim();
    if (!stopId) continue;

    const stopName = String(row.stop_name || "").trim();
    if (!stopName) {
      throw new Error(`Missing stop_name for stop_id "${stopId}" in ${STOP_ROUTE_CSV}`);
    }

    if (!stopById.has(stopId)) {
      stopById.set(stopId, { id: stopId, name: stopName });
    }

    const routeId = String(row.route_id || row.routes || row.route_filter || "").trim();
    if (!routeId || routeId === "All Routes") continue;

    if (!routesByStopId.has(stopId)) routesByStopId.set(stopId, new Set());
    routesByStopId.get(stopId).add(routeId);

    const tripsWdRaw = row.trips_wd;
    if (String(tripsWdRaw || "").trim() === "") {
      throw new Error(`Missing trips_wd for stop "${stopId}" route "${routeId}" in ${STOP_ROUTE_CSV}`);
    }
    const tripsWd = toNonNegativeNumber(tripsWdRaw, `trips_wd for stop ${stopId}, route ${routeId}`);

    const key = `${stopId}::${routeId}`;
    routeTripsByStopId.set(key, (routeTripsByStopId.get(key) || 0) + tripsWd);
  }

  const statusByRoute = new Map();
  for (const row of statusRows) {
    const routeId = String(row.route_code || row.route_label || "").trim();
    if (!routeId) {
      throw new Error(`Missing route_code/route_label in ${STATUS_CSV}`);
    }
    statusByRoute.set(canonicalizeRouteId(routeId), row);
  }

  return { stopById, routesByStopId, routeTripsByStopId, statusByRoute };
}

async function getIndexes() {
  if (!cachedDataPromise) {
    cachedDataPromise = Promise.all([fetchCsv(STOP_ROUTE_CSV), fetchCsv(STATUS_CSV)]).then(
      ([stopRouteRows, statusRows]) => buildIndexes(stopRouteRows, statusRows),
    );
  }
  return cachedDataPromise;
}

function headwayMinutesFromTrips(tripsWd) {
  const tripsPerHour = tripsWd / SERVICE_SPAN_HOURS;
  const rawHeadway = 60 / tripsPerHour;
  return Math.max(MIN_HEADWAY_MINUTES, rawHeadway);
}

function normalizeArea(area) {
  return String(area || "")
    .trim()
    .toLowerCase();
}

function routeTouchesArea(statusRow, selectedArea) {
  const areaKey = normalizeArea(selectedArea);
  const aliases = AREA_ALIASES[areaKey];
  if (!aliases) {
    throw new Error(
      `Unknown selected area "${selectedArea}". Use one of: ${Object.keys(AREA_ALIASES).join(", ")}`,
    );
  }

  const anchors = String(statusRow.anchor_neighborhoods || "").trim().toLowerCase();
  if (!anchors || anchors.startsWith("none")) return false;
  return aliases.some((alias) => anchors.includes(alias));
}

/**
 * Build props for `BusRouteComparison`.
 *
 * Formula used when direct headway is unavailable:
 * - tripsPerHour = trips_wd / 18
 * - headwayMinutes = 60 / tripsPerHour
 *
 * Reduction mapping for "after":
 * - major reduced route: 50% fewer trips (headway doubles)
 * - minor reduced route: 25% fewer trips
 * - eliminated route: no service
 */
export async function buildRouteComparisonProps(stopId, selectedArea = "downtown") {
  const normalizedStopId = String(stopId || "").trim();
  if (!normalizedStopId) {
    throw new Error("buildRouteComparisonProps requires a non-empty stop ID");
  }

  const { stopById, routesByStopId, routeTripsByStopId, statusByRoute } = await getIndexes();

  const stop = stopById.get(normalizedStopId);
  if (!stop) {
    throw new Error(`Stop "${normalizedStopId}" not found in ${STOP_ROUTE_CSV}`);
  }

  const routeSet = routesByStopId.get(normalizedStopId);
  if (!routeSet || routeSet.size === 0) {
    throw new Error(`No routes found for stop "${normalizedStopId}" in ${STOP_ROUTE_CSV}`);
  }

  const sortedRouteIds = Array.from(routeSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
  );

  const routes = sortedRouteIds.flatMap((routeId, index) => {
    const canonicalRouteId = canonicalizeRouteId(routeId);
    let statusRow = statusByRoute.get(canonicalRouteId);
    if (!statusRow && MANUAL_ROUTE_OVERRIDES.has(canonicalRouteId)) {
      statusRow = MANUAL_ROUTE_OVERRIDES.get(canonicalRouteId);
    }
    if (!statusRow) {
      if (IGNORED_ROUTES.has(canonicalRouteId)) {
        return [];
      }
      throw new Error(`Missing status row for route "${routeId}" in ${STATUS_CSV}`);
    }

    if (routeTypeFor(statusRow) !== "non_commuter_bus") {
      return [];
    }

    if (!routeTouchesArea(statusRow, selectedArea)) {
      return [];
    }

    const tripsKey = `${normalizedStopId}::${routeId}`;
    if (!routeTripsByStopId.has(tripsKey)) {
      throw new Error(`Missing stop/route trip row for stop "${normalizedStopId}" route "${routeId}"`);
    }

    const tripsBefore = routeTripsByStopId.get(tripsKey);
    if (!Number.isFinite(tripsBefore) || tripsBefore <= 0) {
      throw new Error(
        `Expected summed trips_wd > 0 for stop "${normalizedStopId}" route "${routeId}", received "${String(tripsBefore)}"`,
      );
    }
    const headwayBefore = headwayMinutesFromTrips(tripsBefore);

    const status = normalizeRouteStatus(statusRow.route_status);
    const reductionFraction = reductionFractionFor(statusRow);
    const tripsAfter = tripsBefore * (1 - reductionFraction);
    const headwayAfter =
      status === "eliminated" || tripsAfter <= 0 ? Number.POSITIVE_INFINITY : headwayMinutesFromTrips(tripsAfter);

    return [{
      id: routeId,
      label: routeId,
      color: routeColorForIndex(index),
      headwayBefore,
      headwayAfter,
      status,
    }];
  });

  if (routes.length === 0) {
    throw new Error(
      `No non-specialized routes from stop "${normalizedStopId}" serve "${selectedArea}".`,
    );
  }

  return { stop, routes, selectedArea: normalizeArea(selectedArea) };
}
