/**
 * Build data/corridor_story_routes.geojson: 71B + P10 from route_lines_current.geojson,
 * with P10 coordinates truncated north of Lincoln-Lemington-Belmar (bbox north latitude).
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { normalizeRouteId } from "../src/lib/equity-map/constants.js";
import { lincolnLemingtonBelmarNorthCapLatFromHoods } from "../src/lib/equity-map/llbNorthCap.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const STORY = new Set(["71B", "P10"]);

const EPS = 1e-10;

/**
 * First contiguous run in coordinate order where lat <= northLat (entering from north or at start).
 * @param {import("geojson").Position[]} coords
 * @param {number} northLat
 * @returns {import("geojson").Position[] | null}
 */
function truncateCoordsAtNorthLat(coords, northLat) {
  if (!coords?.length) return null;
  /** @type {import("geojson").Position[]} */
  const out = [];

  const interp = (a, b) => {
    const [lng1, lat1] = a;
    const [lng2, lat2] = b;
    const den = lat2 - lat1;
    if (Math.abs(den) < EPS) return null;
    const t = (northLat - lat1) / den;
    if (t < -EPS || t > 1 + EPS) return null;
    const t2 = Math.max(0, Math.min(1, t));
    return /** @type {import("geojson").Position} */ ([lng1 + t2 * (lng2 - lng1), northLat]);
  };

  let started = false;

  for (let i = 0; i < coords.length; i++) {
    const p = coords[i];
    const lng = Number(p[0]);
    const lat = Number(p[1]);

    if (!started) {
      if (lat <= northLat + EPS) {
        out.push([lng, lat]);
        started = true;
      } else if (i + 1 < coords.length) {
        const q = coords[i + 1];
        const latq = Number(q[1]);
        if (lat > northLat && latq <= northLat) {
          const ip = interp(p, q);
          if (ip) out.push(ip);
          out.push([Number(q[0]), latq]);
          started = true;
          i++;
        }
      }
      continue;
    }

    const prev = out[out.length - 1];
    if (lat <= northLat + EPS) {
      if (Math.abs(prev[0] - lng) > EPS || Math.abs(prev[1] - lat) > EPS) {
        out.push([lng, lat]);
      }
    } else {
      const ip = interp(prev, p);
      if (ip) {
        const last = out[out.length - 1];
        if (Math.abs(last[0] - ip[0]) > EPS || Math.abs(last[1] - ip[1]) > EPS) out.push(ip);
      }
      break;
    }
  }

  return out.length >= 2 ? out : null;
}

/**
 * @param {GeoJSON.Geometry} geometry
 * @param {number} northLat
 * @returns {GeoJSON.LineString | GeoJSON.MultiLineString | null}
 */
function truncateP10Geometry(geometry, northLat) {
  if (!geometry) return null;
  if (geometry.type === "LineString") {
    const c = truncateCoordsAtNorthLat(geometry.coordinates, northLat);
    return c ? { type: "LineString", coordinates: c } : null;
  }
  if (geometry.type === "MultiLineString") {
    /** @type {import("geojson").Position[][]} */
    const parts = [];
    for (const ring of geometry.coordinates) {
      const c = truncateCoordsAtNorthLat(ring, northLat);
      if (c && c.length >= 2) parts.push(c);
    }
    if (!parts.length) return null;
    if (parts.length === 1) return { type: "LineString", coordinates: parts[0] };
    return { type: "MultiLineString", coordinates: parts };
  }
  return null;
}

function routeIdFromFeature(f) {
  const raw = String(f.properties?.route_id || f.properties?.route_code || "")
    .trim()
    .toUpperCase();
  return normalizeRouteId(raw);
}

function main() {
  const routesPath = join(root, "data", "route_lines_current.geojson");
  const hoodsPath = join(root, "data", "neighborhoods.geojson");
  const outPath = join(root, "data", "corridor_story_routes.geojson");

  const routeGeo = JSON.parse(readFileSync(routesPath, "utf8"));
  const hoodGeo = JSON.parse(readFileSync(hoodsPath, "utf8"));
  const northLat = lincolnLemingtonBelmarNorthCapLatFromHoods(hoodGeo);
  if (northLat == null) {
    throw new Error('No neighborhood polygon found for hood="Lincoln-Lemington-Belmar"');
  }

  let p10In = 0;
  let p10Out = 0;
  let b71 = 0;

  /** @type {GeoJSON.Feature[]} */
  const features = [];

  for (const f of routeGeo.features || []) {
    const rid = routeIdFromFeature(f);
    if (!STORY.has(rid)) continue;

    if (rid === "71B") {
      b71 += 1;
      features.push(JSON.parse(JSON.stringify(f)));
      continue;
    }

    p10In += 1;
    const geom = truncateP10Geometry(f.geometry, northLat);
    if (!geom) {
      console.warn("build-corridor-story-routes: P10 feature dropped after truncate (degenerate)", f.properties);
      continue;
    }
    p10Out += 1;
    features.push({
      ...f,
      geometry: geom,
      properties: { ...f.properties },
    });
  }

  const out = {
    type: "FeatureCollection",
    features,
  };

  writeFileSync(outPath, `${JSON.stringify(out)}\n`, "utf8");
  console.log(
    `build-corridor-story-routes: wrote ${features.length} features (${b71} 71B, ${p10Out}/${p10In} P10 kept) → data/corridor_story_routes.geojson (northLat=${northLat.toFixed(6)})`,
  );
}

main();
