/**
 * Mapbox paint helpers: ground-matched circle radii + zoom resolution steps for the dot map.
 */

import { MAP_CENTER, MAP_INITIAL_ZOOM } from "../mapStyles";

/** Relative to half of neighbor spacing; tier 2 = tangent at grid pitch (three transit sizes). */
export const TRANSIT_BUCKET_MULT = [0.25, 0.65, 1.02];

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
