/**
 * Global rectangular dot grid for EquityMap3: one `pointGrid` over all land hoods,
 * then assign each point to a simplified neighborhood via Turf `pointsWithinPolygon`.
 * Color = poverty tertiles; size = transit quartiles (same cuts as EquityMap2).
 */

import bbox from "@turf/bbox";
import clone from "@turf/clone";
import { featureCollection } from "@turf/helpers";
import pointGrid from "@turf/point-grid";
import { pointsWithinPolygon } from "@turf/turf";
import simplify from "@turf/simplify";

import {
  EQUITY_MAP2_GRID_CELL_KM,
  EQUITY_MAP2_POVERTY_COLORS,
  EQUITY_MAP2_SIMPLIFY_TOLERANCE_DEG,
  povertyColorBucket,
  povertyTercileCuts,
  transitQuartileCuts,
  transitSizeBucket,
} from "./buildEquityMap2Dots";

/** Ground spacing between grid neighbors (km); same value drives radii in `EquityMap3.jsx` (meters on the ground). */
export const EQUITY_MAP3_GRID_CELL_KM = 0.075;

function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function coordKey(lon, lat) {
  return `${lon.toFixed(7)},${lat.toFixed(7)}`;
}

/**
 * @param {import('geojson').FeatureCollection} hoodFc
 * @param {object} [opts]
 * @returns {{
 *   dots: import('geojson').FeatureCollection;
 *   hoodsSimplified: import('geojson').FeatureCollection;
 *   povertyCuts: [number, number];
 *   transitCuts: [number, number, number];
 * }}
 */
export function buildEquityMap3Data(hoodFc, opts = {}) {
  const simplifyTol = opts.simplifyToleranceDeg ?? EQUITY_MAP2_SIMPLIFY_TOLERANCE_DEG;
  const cellKm = opts.cellKm ?? EQUITY_MAP3_GRID_CELL_KM;

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
          dot_color: EQUITY_MAP2_POVERTY_COLORS[pb] ?? EQUITY_MAP2_POVERTY_COLORS[1],
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
