/**
 * Northern latitude cap for Lincoln-Lemington-Belmar story framing (P10 truncate + map pan cap).
 * Threshold sits slightly **north** of the hood bbox north edge (small positive buffer in latitude).
 */
import * as turf from "@turf/turf";

export const LLB_HOOD_NAME = "Lincoln-Lemington-Belmar";

/** Northward offset past bbox north (~65 m at 40°N). */
export const LLB_NORTH_THRESHOLD_BUFFER_DEG = 0.0006;

/**
 * @param {GeoJSON.FeatureCollection} hoodGeo neighborhoods with `properties.hood`
 * @returns {number | null} northern latitude cap (null if hood missing)
 */
export function lincolnLemingtonBelmarNorthCapLatFromHoods(hoodGeo) {
  const feats = (hoodGeo?.features || []).filter(
    (x) => String(x.properties?.hood || "").trim() === LLB_HOOD_NAME,
  );
  if (!feats.length) return null;
  try {
    const box = turf.bbox({ type: "FeatureCollection", features: feats });
    if (!box.every(Number.isFinite)) return null;
    return box[3] + LLB_NORTH_THRESHOLD_BUFFER_DEG;
  } catch {
    return null;
  }
}
