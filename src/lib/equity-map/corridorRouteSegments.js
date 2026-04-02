import * as turf from "@turf/turf";

/**
 * Turf line feature for intersection tests.
 * @param {GeoJSON.LineString | GeoJSON.MultiLineString} geom
 * @returns {import("@turf/helpers").Feature<GeoJSON.LineString | GeoJSON.MultiLineString> | null}
 */
function geometryToLineFeature(geom) {
  if (geom.type === "LineString") return turf.lineString(geom.coordinates);
  if (geom.type === "MultiLineString") return turf.multiLineString(geom.coordinates);
  return null;
}

/**
 * Neighborhoods whose polygon intersects any story-route geometry.
 * @param {GeoJSON.Feature[]} routeFeatures
 * @param {GeoJSON.FeatureCollection} hoodGeo
 * @returns {Set<string>}
 */
export function hoodNamesTouchingRoutes(routeFeatures, hoodGeo) {
  const touched = new Set();
  for (const f of routeFeatures) {
    const lf = geometryToLineFeature(f.geometry);
    if (!lf) continue;
    for (const poly of hoodGeo.features) {
      if (!poly.geometry) continue;
      try {
        if (turf.booleanIntersects(lf, poly)) {
          const n = String(poly.properties?.hood || "").trim();
          if (n) touched.add(n);
        }
      } catch {
        /* invalid geometry pair */
      }
    }
  }
  return touched;
}
