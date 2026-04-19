/**
 * Clip 71B / P10 route polylines on the corridor map to the segment between
 * persona boarding and alighting neighborhoods (hood centroid → nearest point on line, Turf `lineSlice`).
 *
 * Choropleth “on corridor” uses **full** route geometry in `CorridorScrollMap` before this clip is applied;
 * this module is **display-only** for the `corridor-routes` layer.
 */
import * as turf from "@turf/turf";

/** @typedef {{ boardHood: string; alightHood: string }} PersonaRouteAnchors */

/** @type {Record<string, PersonaRouteAnchors>} */
export const CORRIDOR_PERSONA_ROUTE_ANCHORS = {
  "71B": {
    boardHood: "Stanton Heights",
    alightHood: "Central Business District",
  },
  P10: {
    boardHood: "Lincoln-Lemington-Belmar",
    alightHood: "Central Business District",
  },
};

/**
 * @param {GeoJSON.FeatureCollection} hoodGeo
 * @param {string} hoodName
 * @returns {[number, number] | null} [lng, lat]
 */
function centroidLngLatForHood(hoodGeo, hoodName) {
  const f = hoodGeo.features?.find((x) => String(x.properties?.hood || "").trim() === hoodName);
  if (!f?.geometry) return null;
  try {
    const c = turf.centroid(f);
    const coords = c.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    return [coords[0], coords[1]];
  } catch {
    return null;
  }
}

/**
 * @param {GeoJSON.Geometry} geometry
 * @returns {import("@turf/helpers").Feature<GeoJSON.LineString>[]}
 */
function lineStringParts(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") {
    if (!geometry.coordinates?.length) return [];
    return [turf.lineString(geometry.coordinates)];
  }
  if (geometry.type === "MultiLineString") {
    /** @type {import("@turf/helpers").Feature<GeoJSON.LineString>[]} */
    const out = [];
    for (const coords of geometry.coordinates) {
      if (!coords?.length) continue;
      try {
        const ls = turf.lineString(coords);
        if (turf.length(ls, { units: "kilometers" }) > 0) out.push(ls);
      } catch {
        /* skip */
      }
    }
    return out;
  }
  return [];
}

const MIN_SLICE_KM = 0.12;

/**
 * @param {GeoJSON.Geometry} geometry
 * @param {string} routeId normalized (`71B` | `P10`)
 * @param {GeoJSON.FeatureCollection} hoodGeo neighborhoods (needs `properties.hood`)
 * @returns {GeoJSON.Geometry}
 */
export function clipCorridorPersonaRoute(geometry, routeId, hoodGeo) {
  const anchors = CORRIDOR_PERSONA_ROUTE_ANCHORS[routeId];
  if (!anchors || !hoodGeo?.features?.length) return geometry;

  const board = centroidLngLatForHood(hoodGeo, anchors.boardHood);
  const alight = centroidLngLatForHood(hoodGeo, anchors.alightHood);
  if (!board || !alight) return geometry;

  const parts = lineStringParts(geometry);
  if (!parts.length) return geometry;

  /** @type {GeoJSON.LineString | null} */
  let best = null;
  let bestLen = 0;

  for (const line of parts) {
    try {
      const sliced = turf.lineSlice(turf.point(board), turf.point(alight), line);
      const km = turf.length(sliced, { units: "kilometers" });
      if (Number.isFinite(km) && km >= MIN_SLICE_KM && km > bestLen) {
        bestLen = km;
        best = sliced.geometry;
      }
    } catch {
      /* try next part */
    }
  }

  return best ?? geometry;
}
