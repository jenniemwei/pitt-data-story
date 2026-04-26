/**
 * Build GeoJSON for the bivariate dot map: global `pointGrid`, point-in-polygon → neighborhood;
 * poverty: two buckets (≥20% vs &lt;20% ACS below-poverty share) → color;
 * transit proxy: fixed bands — no dot &lt;5%; smallest 5–10%; medium &gt;10–20%; largest &gt;20%.
 */

import bbox from "@turf/bbox";
import clone from "@turf/clone";
import { featureCollection } from "@turf/helpers";
import pointGrid from "@turf/point-grid";
import { pointsWithinPolygon } from "@turf/turf";
import simplify from "@turf/simplify";
import {
  POVERTY_HIGH_THRESHOLD,
  TRANSIT_DOT_MEDIUM_MAX_RATIO,
  TRANSIT_DOT_MIN_RATIO,
  TRANSIT_DOT_SMALL_MAX_RATIO,
} from "../constants";

// map styles
const POVERTY_LEVEL_COLORS = ["#D1CDC8", "#FFA883", "#D85C4D"];

/** Exported for coverage map dot grid — same simplify tolerance as {@link buildDotMapGeojson}. */
export const DOT_MAP_SIMPLIFY_TOLERANCE_DEG = 0.00055;
/** Exported for coverage map dot grid — same cell size as {@link buildDotMapGeojson}. */
export const DOT_MAP_DEFAULT_CELL_KM = 0.075;

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function quantileSorted(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** @param {number[]} values */
export function povertyTercileCuts(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [0.15, 0.25];
  return [quantileSorted(sorted, 1 / 3), quantileSorted(sorted, 2 / 3)];
}

/** @param {number} p — poverty rate; if &gt; 1, treated as whole percent (÷100). */
export function povertyRateAsRatio(p) {
  if (!Number.isFinite(p)) return null;
  return p > 1 ? p / 100 : p;
}

/** 0 = below {@link POVERTY_HIGH_THRESHOLD}, 1 = at or above (20%+ when threshold is 0.2). */
export function povertyDualBucketFromRate(p) {
  const r = povertyRateAsRatio(p);
  if (r == null) return 0;
  return r >= POVERTY_HIGH_THRESHOLD ? 1 : 0;
}

/** @param {number} p @param {[number, number]} cuts */
export function povertyColorBucket(p, cuts) {
  const [t1, t2] = cuts;
  if (p <= t1) return 0;
  if (p <= t2) return 1;
  return 2;
}

/** Normalize transit proxy to 0–1 (whole percent in source → ÷100). */
export function transitDependenceRatio(raw) {
  const t = Number(raw);
  if (!Number.isFinite(t)) return NaN;
  return t > 1 ? t / 100 : t;
}

/**
 * Fixed transit size bucket for dot maps. `null` = do not draw a dot (below {@link TRANSIT_DOT_MIN_RATIO}).
 * @returns {0 | 1 | 2 | null}
 */
export function transitSizeBucketFromRatio(rawTransit) {
  const r = transitDependenceRatio(rawTransit);
  if (!Number.isFinite(r) || r < TRANSIT_DOT_MIN_RATIO) return null;
  if (r <= TRANSIT_DOT_SMALL_MAX_RATIO) return 0;
  if (r <= TRANSIT_DOT_MEDIUM_MAX_RATIO) return 1;
  return 2;
}

/** Legend for fixed transit bands (matches `transitSizeBucketFromRatio`). */
export function transitSizeLegendFixed() {
  const p = (x) => `${Math.round(x * 100)}%`;
  return {
    caption: `No dots below ${p(TRANSIT_DOT_MIN_RATIO)}. Smallest ${p(TRANSIT_DOT_MIN_RATIO)}–${p(TRANSIT_DOT_SMALL_MAX_RATIO)}; medium >${p(TRANSIT_DOT_SMALL_MAX_RATIO)}–${p(TRANSIT_DOT_MEDIUM_MAX_RATIO)}; largest >${p(TRANSIT_DOT_MEDIUM_MAX_RATIO)}. Dot radii scale 1∶2∶3.`,
    entries: [
      { b: 2, label: `Largest — > ${p(TRANSIT_DOT_MEDIUM_MAX_RATIO)}` },
      { b: 1, label: `Medium — > ${p(TRANSIT_DOT_SMALL_MAX_RATIO)}–${p(TRANSIT_DOT_MEDIUM_MAX_RATIO)}` },
      { b: 0, label: `Smallest — ${p(TRANSIT_DOT_MIN_RATIO)}–${p(TRANSIT_DOT_SMALL_MAX_RATIO)}` },
    ],
  };
}

function coordKey(lon, lat) {
  return `${lon.toFixed(7)},${lat.toFixed(7)}`;
}

/**
 * @param {import('geojson').FeatureCollection} hoodFc
 * @param {object} [opts]
 * @param {number} [opts.cellKm]
 * @param {number} [opts.simplifyToleranceDeg]
 */
export function buildDotMapGeojson(hoodFc, opts = {}) {
  const simplifyTol = opts.simplifyToleranceDeg ?? DOT_MAP_SIMPLIFY_TOLERANCE_DEG;
  const cellKm = opts.cellKm ?? DOT_MAP_DEFAULT_CELL_KM;

  const landFeatures = hoodFc.features.filter((f) => safeFloat(f.properties?.is_water, 0) !== 1);

  /** @type {{ simplified: import('geojson').Feature; hood: string; poverty: number; pb: number; tb: number | null; servesP1071b: number; transit: number }[]} */
  const prepared = [];

  for (const f of landFeatures) {
    const hood = (f.properties?.neighborhood_name || f.properties?.hood || "").trim();
    const poverty = safeFloat(f.properties?.poverty_rate);
    const transit = safeFloat(f.properties?.pct_transit_dependent);
    const servesP1071b = safeFloat(f.properties?.serves_p10_71b, 0);
    const pb = povertyDualBucketFromRate(poverty);
    const tb = transitSizeBucketFromRatio(transit);

    const simplified = simplify(clone(f), { tolerance: simplifyTol, highQuality: true });
    prepared.push({ simplified, hood, poverty, pb, tb, servesP1071b, transit });
  }

  const simplifiedPolys = prepared.map((p) => p.simplified);
  if (!simplifiedPolys.length) {
    return {
      dots: featureCollection([]),
      hoodsSimplified: featureCollection([]),
      povertyCuts: [POVERTY_HIGH_THRESHOLD, POVERTY_HIGH_THRESHOLD],
    };
  }

  const extent = bbox(featureCollection(simplifiedPolys));
  const grid = pointGrid(extent, cellKm, { units: "kilometers" });

  const claimed = new Set();
  const dotFeatures = [];

  for (const { simplified, hood, poverty, pb, tb, servesP1071b, transit } of prepared) {
    if (tb == null) continue;
    let inside;
    try {
      inside = pointsWithinPolygon(grid, simplified);
    } catch {
      continue;
    }
    for (const cell of inside.features) {
      const [lon, lat] = cell.geometry.coordinates;
      const key = coordKey(lon, lat);
      if (claimed.has(key)) continue;
      claimed.add(key);
      dotFeatures.push({
        type: "Feature",
        geometry: cell.geometry,
        properties: {
          neighborhood_name: hood,
          poverty_bucket: pb,
          transit_bucket: tb,
          poverty_rate: poverty,
          transit_dependent: transit,
          serves_p10_71b: servesP1071b,
          dot_color: POVERTY_LEVEL_COLORS[pb === 1 ? 2 : 0] ?? POVERTY_LEVEL_COLORS[0],
        },
      });
    }
  }

  return {
    dots: featureCollection(dotFeatures),
    hoodsSimplified: featureCollection(simplifiedPolys),
    povertyCuts: [POVERTY_HIGH_THRESHOLD, POVERTY_HIGH_THRESHOLD],
  };
}

function safeLostCoverageRatio(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Global point grid + simplified polygons (same pattern as {@link buildDotMapGeojson}):
 * one `pointGrid` over combined bbox, `pointsWithinPolygon` per hood, `claimed` coord de-duping.
 * Dot `lost_coverage` comes from FY26 proportional loss (0–1); radius scales in the map layer.
 *
 * @param {import('geojson').FeatureCollection} hoodFc — features need `lost_coverage`, `neighborhood_name` or `hood`, optional `is_water`
 * @param {object} [opts]
 * @param {number} [opts.cellKm]
 * @param {number} [opts.simplifyToleranceDeg]
 */
export function buildLostCoverageDotGridGeojson(hoodFc, opts = {}) {
  const simplifyTol = opts.simplifyToleranceDeg ?? DOT_MAP_SIMPLIFY_TOLERANCE_DEG;
  const cellKm = opts.cellKm ?? DOT_MAP_DEFAULT_CELL_KM;

  const landFeatures = hoodFc.features.filter((f) => safeFloat(f.properties?.is_water, 0) !== 1);

  /** @type {{ simplified: import('geojson').Feature; hood: string; lostCoverage: number }[]} */
  const prepared = [];

  for (const f of landFeatures) {
    const hood = (f.properties?.neighborhood_name || f.properties?.hood || "").trim();
    const lostCoverage = safeLostCoverageRatio(f.properties?.lost_coverage);
    const simplified = simplify(clone(f), { tolerance: simplifyTol, highQuality: true });
    prepared.push({ simplified, hood, lostCoverage });
  }

  const simplifiedPolys = prepared.map((p) => p.simplified);
  if (!simplifiedPolys.length) {
    return {
      dots: featureCollection([]),
      hoodsSimplified: featureCollection([]),
    };
  }

  const extent = bbox(featureCollection(simplifiedPolys));
  let grid;
  try {
    grid = pointGrid(extent, cellKm, { units: "kilometers" });
  } catch {
    return {
      dots: featureCollection([]),
      hoodsSimplified: featureCollection(simplifiedPolys),
    };
  }

  const claimed = new Set();
  const dotFeatures = [];

  for (const { simplified, hood, lostCoverage } of prepared) {
    let inside;
    try {
      inside = pointsWithinPolygon(grid, simplified);
    } catch {
      continue;
    }
    for (const cell of inside.features) {
      const [lon, lat] = cell.geometry.coordinates;
      const key = coordKey(lon, lat);
      if (claimed.has(key)) continue;
      claimed.add(key);
      dotFeatures.push({
        type: "Feature",
        geometry: cell.geometry,
        properties: {
          neighborhood_name: hood,
          lost_coverage: lostCoverage,
        },
      });
    }
  }

  return {
    dots: featureCollection(dotFeatures),
    hoodsSimplified: featureCollection(simplifiedPolys),
  };
}
