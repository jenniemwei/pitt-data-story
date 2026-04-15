/**
 * Build GeoJSON for the bivariate dot map: global `pointGrid`, point-in-polygon → neighborhood;
 * poverty tertiles → color, transit proxy → three size buckets.
 */

import bbox from "@turf/bbox";
import clone from "@turf/clone";
import { featureCollection } from "@turf/helpers";
import pointGrid from "@turf/point-grid";
import { pointsWithinPolygon } from "@turf/turf";
import simplify from "@turf/simplify";

import { POVERTY_LEVEL_COLORS } from "../../../components/data-viz/equity-map/mapStyles";
import {
  binFromCuts,
  quartileUpperEdges,
  sortedProp,
  transitSizeBucketFromQuartileCuts,
} from "../quartileBins";

const DOT_MAP_SIMPLIFY_TOLERANCE_DEG = 0.00055;
const DOT_MAP_DEFAULT_CELL_KM = 0.075;

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

function transitQuartileCuts(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return [0.08, 0.15, 0.22];
  return [
    quantileSorted(sorted, 0.25),
    quantileSorted(sorted, 0.5),
    quantileSorted(sorted, 0.75),
  ];
}

/** @param {number} p @param {[number, number]} cuts */
export function povertyColorBucket(p, cuts) {
  const [t1, t2] = cuts;
  if (p <= t1) return 0;
  if (p <= t2) return 1;
  return 2;
}

/** 0 = t ≤ Q2, 1 = Q2 < t ≤ Q3, 2 = t > Q3 */
function transitSizeBucket(t, q) {
  const [, q2, q3] = q;
  if (t <= q2) return 0;
  if (t <= q3) return 1;
  return 2;
}

/**
 * Legend copy for three transit-dependence dot sizes (same bands as `transitSizeBucket`).
 * @param {[number, number, number]} cuts — Q1, Q2, Q3
 */
export function transitSizeLegendFromCuts(cuts) {
  const [q1, q2, q3] = cuts;
  const p = (x) => `${(x * 100).toFixed(1)}%`;
  return {
    caption: `Three size bands (worker transit-commute proxy): smallest up to ${p(q2)} (combines lowest and second quartiles); medium ${p(q2)}–${p(q3)}; largest above ${p(q3)} (tangent at grid). Reference quartiles: 25th ${p(q1)}, 50th ${p(q2)}, 75th ${p(q3)}.`,
    entries: [
      { b: 2, label: `High — largest: above ${p(q3)}` },
      { b: 1, label: `Medium: above ${p(q2)} through ${p(q3)}` },
      { b: 0, label: `Low / medium-low — smallest: up to ${p(q2)}` },
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

  const povertyVals = landFeatures.map((f) => safeFloat(f.properties?.poverty_rate));
  const transitVals = landFeatures.map((f) => safeFloat(f.properties?.pct_transit_dependent));
  const povertyCuts = povertyTercileCuts(povertyVals);
  const transitCuts = transitQuartileCuts(transitVals);

  /** @type {{ simplified: import('geojson').Feature; hood: string; poverty: number; pb: number; tb: number; servesP1071b: number; transit: number }[]} */
  const prepared = [];

  for (const f of landFeatures) {
    const hood = (f.properties?.neighborhood_name || f.properties?.hood || "").trim();
    const poverty = safeFloat(f.properties?.poverty_rate);
    const transit = safeFloat(f.properties?.pct_transit_dependent);
    const servesP1071b = safeFloat(f.properties?.serves_p10_71b, 0);
    const pb = povertyColorBucket(poverty, povertyCuts);
    const tb = transitSizeBucket(transit, transitCuts);

    const simplified = simplify(clone(f), { tolerance: simplifyTol, highQuality: true });
    prepared.push({ simplified, hood, poverty, pb, tb, servesP1071b, transit });
  }

  const simplifiedPolys = prepared.map((p) => p.simplified);
  if (!simplifiedPolys.length) {
    return {
      dots: featureCollection([]),
      hoodsSimplified: featureCollection([]),
      povertyCuts,
      transitCuts,
    };
  }

  const extent = bbox(featureCollection(simplifiedPolys));
  const grid = pointGrid(extent, cellKm, { units: "kilometers" });

  const claimed = new Set();
  const dotFeatures = [];

  for (const { simplified, hood, poverty, pb, tb, servesP1071b, transit } of prepared) {
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
          dot_color: POVERTY_LEVEL_COLORS[pb] ?? POVERTY_LEVEL_COLORS[1],
        },
      });
    }
  }

  return {
    dots: featureCollection(dotFeatures),
    hoodsSimplified: featureCollection(simplifiedPolys),
    povertyCuts,
    transitCuts,
  };
}

/**
 * Corridor scroll map: same lattice as `buildDotMapGeojson`, but poverty uses **4 quartile bins**
 * on 71B/P10–touched hoods (matches choropleth); transit sizes use **touched-hood** quartile cuts.
 * @param {import('geojson').FeatureCollection} hoodFc — land features with `on_corridor`, `poverty_rate`, `pct_transit_dependent`, etc.
 */
export function buildCorridorScrollDotsGeojson(hoodFc, opts = {}) {
  const simplifyTol = opts.simplifyToleranceDeg ?? DOT_MAP_SIMPLIFY_TOLERANCE_DEG;
  const cellKm = opts.cellKm ?? DOT_MAP_DEFAULT_CELL_KM;

  const landFeatures = hoodFc.features.filter((f) => safeFloat(f.properties?.is_water, 0) !== 1);
  const touchedFeat = landFeatures.filter((f) => safeFloat(f.properties?.on_corridor, 0) === 1);

  const pCutsC = quartileUpperEdges(sortedProp(touchedFeat, "poverty_rate"));
  const tCutsC = quartileUpperEdges(sortedProp(touchedFeat, "pct_transit_dependent"));

  /** @type {{ simplified: import('geojson').Feature; hood: string; poverty: number; transit: number; poverty_bin_c: number; transit_bucket: number }[]} */
  const prepared = [];

  for (const f of landFeatures) {
    const hood = (f.properties?.neighborhood_name || f.properties?.hood || "").trim();
    const poverty = safeFloat(f.properties?.poverty_rate);
    const transit = safeFloat(f.properties?.pct_transit_dependent);
    const poverty_bin_c = binFromCuts(poverty, pCutsC);
    const transit_bucket = transitSizeBucketFromQuartileCuts(transit, tCutsC);

    const simplified = simplify(clone(f), { tolerance: simplifyTol, highQuality: true });
    prepared.push({ simplified, hood, poverty, transit, poverty_bin_c, transit_bucket });
  }

  const simplifiedPolys = prepared.map((p) => p.simplified);
  if (!simplifiedPolys.length) {
    return {
      dots: featureCollection([]),
      hoodsSimplified: featureCollection(simplifiedPolys),
      pCutsC,
      tCutsC,
    };
  }

  const extent = bbox(featureCollection(simplifiedPolys));
  const grid = pointGrid(extent, cellKm, { units: "kilometers" });

  const claimed = new Set();
  const dotFeatures = [];

  for (const { simplified, hood, poverty, transit, poverty_bin_c, transit_bucket } of prepared) {
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
          poverty_bin_c,
          transit_bucket,
          poverty_rate: poverty,
          transit_dependent: transit,
        },
      });
    }
  }

  return {
    dots: featureCollection(dotFeatures),
    hoodsSimplified: featureCollection(simplifiedPolys),
    pCutsC,
    tCutsC,
  };
}
