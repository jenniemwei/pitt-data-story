/**
 * Ramer–Douglas–Peucker simplification for route LineStrings (WGS84 degrees).
 * Coordinates remain in [lng, lat] order.
 */

/** @param {[number, number]} p @param {[number, number]} a @param {[number, number]} b */
function perpendicularDistanceSq(p, a, b) {
  const x = p[0];
  const y = p[1];
  const x1 = a[0];
  const y1 = a[1];
  const x2 = b[0];
  const y2 = b[1];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const qx = x - x1;
    const qy = y - y1;
    return qx * qx + qy * qy;
  }
  let t = ((x - x1) * dx + (y - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  const qx = x - nx;
  const qy = y - ny;
  return qx * qx + qy * qy;
}

/**
 * @param {[number, number][]} points
 * @param {number} toleranceSq — squared tolerance in degree²
 * @returns {[number, number][]}
 */
function rdpLine(points, toleranceSq) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let idx = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistanceSq(points[i], points[0], points[last]);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist > toleranceSq) {
    const left = rdpLine(points.slice(0, idx + 1), toleranceSq);
    const right = rdpLine(points.slice(idx), toleranceSq);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[last]];
}

/**
 * Slight smoothing: drop vertices within `toleranceDeg` of the simplified polyline.
 * @param {[number, number][]} coordinates
 * @param {number} toleranceDeg — ~0.0001° ≈ 11 m; use ~0.00008–0.00012 for subtle
 */
export function simplifyLineStringCoordinates(coordinates, toleranceDeg) {
  if (!coordinates?.length) return coordinates;
  if (coordinates.length <= 2) return coordinates;
  const tolSq = toleranceDeg * toleranceDeg;
  return rdpLine(coordinates, tolSq);
}

/**
 * @param {{ type: string; coordinates?: unknown } | null | undefined} geometry
 * @param {number} toleranceDeg
 */
export function simplifyRouteGeometry(geometry, toleranceDeg) {
  if (!geometry) return geometry;
  if (geometry.type === "LineString") {
    return {
      ...geometry,
      coordinates: simplifyLineStringCoordinates(geometry.coordinates, toleranceDeg),
    };
  }
  if (geometry.type === "MultiLineString") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((line) => simplifyLineStringCoordinates(line, toleranceDeg)),
    };
  }
  return geometry;
}

/** Default tolerance for equity map route overlay (subtle corner reduction). */
export const ROUTE_GEOMETRY_SIMPLIFY_TOLERANCE_DEG = 0.0001;
