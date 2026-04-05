/**
 * URL for CSV/GeoJSON served from `public/data/` (see scripts/sync-public-data.mjs).
 * Same path in `next dev`, static export, and GitHub Pages — run sync before dev/build.
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

export function dataAssetUrl(filename) {
  const base = publicPathPrefix();
  return `${base}/data/${filename}`;
}
