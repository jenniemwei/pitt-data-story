/**
 * Build a dense point grid clipped to simplified neighborhood polygons for EquityMap2.
 * Bivariate encoding: poverty → color (tertiles), transit dependence → circle radius (quartiles).
 */

import bbox from "@turf/bbox";
import clone from "@turf/clone";
import { featureCollection } from "@turf/helpers";
import pointGrid from "@turf/point-grid";
import simplify from "@turf/simplify";

/** ~55m simplification — fewer vertices so clipping + grid stay fast and shapes read cleanly. */
export const EQUITY_MAP2_SIMPLIFY_TOLERANCE_DEG = 0.00055;

/** ~175m between point centers — compact grid (turf point-grid step in km). */
export const EQUITY_MAP2_GRID_CELL_KM = 0.075;

/** Low / medium / high poverty — low = neutral grey; mid / high match story accents. */
export const EQUITY_MAP2_POVERTY_COLORS = ["#959595", "#e8884a", "#c83c3c"];

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Linear quantile on a sorted array, p in [0, 1].
 * @param {number[]} sorted
 * @param {number} p
 */
function quantileSorted(sorted, p) {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * @param {number[]} values
 * @returns {[number, number]} T1, T2 — values at ~33rd and ~67th percentile (inclusive low buckets)
 */
export function povertyTercileCuts(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [0.15, 0.25];
  return [quantileSorted(sorted, 1 / 3), quantileSorted(sorted, 2 / 3)];
}

/**
 * @param {number[]} values
 * @returns {[number, number, number]} Q1, Q2, Q3
 */
export function transitQuartileCuts(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [0.08, 0.15, 0.22];
  return [
    quantileSorted(sorted, 0.25),
    quantileSorted(sorted, 0.5),
    quantileSorted(sorted, 0.75),
  ];
}

/**
 * Higher transit share → larger bucket index (0 = smallest dots … 3 = largest).
 * @param {number} t
 * @param {[number, number, number]} q
 */
export function transitSizeBucket(t, q) {
  const [q1, q2, q3] = q;
  if (t <= q1) return 0;
  if (t <= q2) return 1;
  if (t <= q3) return 2;
  return 3;
}

/**
 * @param {number} p
 * @param {[number, number]} cuts
 */
export function povertyColorBucket(p, cuts) {
  const [t1, t2] = cuts;
  if (p <= t1) return 0;
  if (p <= t2) return 1;
  return 2;
}

/**
 * @param {import('geojson').FeatureCollection} hoodFc — features must include properties:
 *   neighborhood_name, poverty_rate, pct_transit_dependent, is_water (0|1), is_featured (0|1), serves_p10_71b (0|1)
 * @param {object} [opts]
 * @returns {{
 *   dots: import('geojson').FeatureCollection;
 *   hoodsSimplified: import('geojson').FeatureCollection;
 *   povertyCuts: [number, number];
 *   transitCuts: [number, number, number];
 * }}
 */
export function buildEquityMap2Data(hoodFc, opts = {}) {
  const simplifyTol = opts.simplifyToleranceDeg ?? EQUITY_MAP2_SIMPLIFY_TOLERANCE_DEG;
  const cellKm = opts.cellKm ?? EQUITY_MAP2_GRID_CELL_KM;

  const landFeatures = hoodFc.features.filter((f) => safeFloat(f.properties?.is_water, 0) !== 1);

  const povertyVals = landFeatures.map((f) => safeFloat(f.properties?.poverty_rate));
  const transitVals = landFeatures.map((f) => safeFloat(f.properties?.pct_transit_dependent));
  const povertyCuts = povertyTercileCuts(povertyVals);
  const transitCuts = transitQuartileCuts(transitVals);

  const dotFeatures = [];
  const simplifiedPolys = [];

  for (const f of landFeatures) {
    const hood = (f.properties?.neighborhood_name || f.properties?.hood || "").trim();
    const poverty = safeFloat(f.properties?.poverty_rate);
    const transit = safeFloat(f.properties?.pct_transit_dependent);
    const servesP1071b = safeFloat(f.properties?.serves_p10_71b, 0);
    const pb = povertyColorBucket(poverty, povertyCuts);
    const tb = transitSizeBucket(transit, transitCuts);

    const simplified = simplify(clone(f), { tolerance: simplifyTol, highQuality: true });
    simplifiedPolys.push(simplified);

    try {
      const ext = bbox(simplified);
      const grid = pointGrid(ext, cellKm, {
        units: "kilometers",
        mask: simplified,
      });

      for (const cell of grid.features) {
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
            dot_color: EQUITY_MAP2_POVERTY_COLORS[pb] ?? EQUITY_MAP2_POVERTY_COLORS[1],
          },
        });
      }
    } catch {
      /* skip invalid / empty geometries */
    }
  }

  return {
    dots: featureCollection(dotFeatures),
    hoodsSimplified: featureCollection(simplifiedPolys),
    povertyCuts,
    transitCuts,
  };
}
