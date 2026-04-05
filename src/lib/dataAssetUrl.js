/**
 * Builds a URL for whitelisted CSV/GeoJSON in `data/` (see `app/api/data/route.js`).
 * - Next dev: `/api/data?name=…` (routed server-side).
 * - Static export / GitHub Pages: `/data/…` (files copied into `public/data` before build).
 */

function publicPathPrefix() {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH;
  }
  if (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) {
    const u = import.meta.env.BASE_URL;
    if (u === "/" || u === "./") return "";
    return String(u).replace(/\/$/, "");
  }
  return "";
}

function dataMode() {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_DATA_MODE) {
    return process.env.NEXT_PUBLIC_DATA_MODE;
  }
  return "public";
}

export function dataAssetUrl(filename) {
  const base = publicPathPrefix();
  const mode = dataMode();
  if (mode === "api") {
    return `${base}/api/data?name=${encodeURIComponent(filename)}`;
  }
  return `${base}/data/${filename}`;
}
