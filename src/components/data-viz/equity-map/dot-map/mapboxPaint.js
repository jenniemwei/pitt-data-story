/**
 * Mapbox paint helpers: ground-matched circle radii + zoom resolution steps for the dot map.
 */

// map styles
const MAP_CENTER = [-79.9959, 40.4406];
const MAP_INITIAL_ZOOM = 10.1;

/** Relative to half of neighbor spacing; strict 1∶2∶3 area feel (smallest bumped vs older 0.25 tier). */
export const TRANSIT_BUCKET_MULT = [0.34, 0.68, 1.02];

/** Legend swatch scale — proportional to `TRANSIT_BUCKET_MULT`. */
export const TRANSIT_LEGEND_RADIUS = {
  0: TRANSIT_BUCKET_MULT[0],
  1: TRANSIT_BUCKET_MULT[1],
  2: TRANSIT_BUCKET_MULT[2],
};

const EARTH_CIRCUMFERENCE_M = 40075017;

function metersPerPixelAtLatZoom(latDeg, zoom) {
  const latRad = (latDeg * Math.PI) / 180;
  return (Math.cos(latRad) * EARTH_CIRCUMFERENCE_M) / (2 ** zoom * 512);
}

function neighborSpacingMeters(cellKm) {
  return cellKm * 1000;
}

function radiusMetersForTransitBucket(cellKm, bucket) {
  return (neighborSpacingMeters(cellKm) / 2) * TRANSIT_BUCKET_MULT[bucket];
}

function radiusPxForTransitBucket(latDeg, zoom, cellKm, bucket) {
  const mpp = metersPerPixelAtLatZoom(latDeg, zoom);
  return radiusMetersForTransitBucket(cellKm, bucket) / mpp;
}

/** Half neighbor spacing in px (same base as smallest transit bucket without TRANSIT_BUCKET_MULT). */
function radiusPxHalfCell(latDeg, zoom, cellKm) {
  const mpp = metersPerPixelAtLatZoom(latDeg, zoom);
  const radiusMeters = neighborSpacingMeters(cellKm) / 2;
  return radiusMeters / mpp;
}

/**
 * Mapbox `circle-radius`: ground-matched half-cell radius × `lost_coverage` (0–1), by zoom.
 * Pairs with {@link DOT_MAP_RESOLUTION_STEPS} the same way as {@link circleRadiusGroundMatchExpression}.
 */
export function circleRadiusLostCoverageExpression(cellKm) {
  const lat = MAP_CENTER[1];
  const z = MAP_INITIAL_ZOOM;
  const radiusAt = (zoom) => [
    "*",
    radiusPxHalfCell(lat, zoom, cellKm),
    ["coalesce", ["get", "lost_coverage"], 0],
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    z,
    radiusAt(z),
    z + 2,
    radiusAt(z + 2),
    z + 4,
    radiusAt(z + 4),
    z + 6.5,
    radiusAt(z + 6.5),
  ];
}

/** Mapbox `circle-radius` from `transit_bucket` and zoom for a given grid `cellKm`. */
export function circleRadiusGroundMatchExpression(cellKm) {
  const lat = MAP_CENTER[1];
  const z = MAP_INITIAL_ZOOM;
  const bucketAt = (zoom) => [
    "match",
    ["to-number", ["get", "transit_bucket"]],
    0,
    radiusPxForTransitBucket(lat, zoom, cellKm, 0),
    1,
    radiusPxForTransitBucket(lat, zoom, cellKm, 1),
    2,
    radiusPxForTransitBucket(lat, zoom, cellKm, 2),
    radiusPxForTransitBucket(lat, zoom, cellKm, 0),
  ];
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    z,
    bucketAt(z),
    z + 2,
    bucketAt(z + 2),
    z + 4,
    bucketAt(z + 4),
    z + 6.5,
    bucketAt(z + 6.5),
  ];
}

/** Coarser grid at low zoom; finer as you zoom in (`cellKm` = Turf pointGrid step in km). */
export const DOT_MAP_RESOLUTION_STEPS = [
  { cellKm: 0.25, maxZoom: 11.5 },
  { cellKm: 0.15, minZoom: 11.5, maxZoom: 13 },
  { cellKm: 0.075, minZoom: 13 },
];
