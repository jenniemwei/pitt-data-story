/**
 * Copy approved data files from `data/` into `public/data` for Next dev, static export, and
 * Vercel — the app fetches from `/data/…` (see `src/lib/dataAssetUrl.js`), not from `data/` directly.
 *
 * **Why a copy step (vs only editing `public/data` by hand):**
 * - A single *source* under `data/` can be rebuilt from primary tables + crosswalks (reproducible;
 *   same `hood` keys as the map). `sync-data` is the one place that publishes those into the static
 *   URL space.
 * - You can still commit a hand-maintained `public/data/display_profiles_2024.csv` if the source
 *   in `data/` is absent: sync will skip the copy, and the committed public file is what deploy serves.
 * Keep the allowlist aligned with any `dataAssetUrl("…")` filenames in the app.
 */
import { cpSync, existsSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const allowed = [
  "neighborhoods.geojson",
  "corridor_story_routes.geojson",
  "route_lines_current.geojson",
  "fy26_route_n_profiles_all.csv",
  "n_crosswalk.csv",
  "n_profiles_new.csv",
  "display_profiles_2024.csv",
  "FY26_route_status_all.csv",
  "demographics.csv",
  "routes_with_demographics.csv",
  "ridership.csv",
  "route_demographics.csv",
];

const destDir = join(root, "public", "data");
mkdirSync(destDir, { recursive: true });

let copied = 0;
for (const f of allowed) {
  const src = join(root, "data", f);
  if (!existsSync(src)) {
    console.warn(`sync-public-data: skip (missing source): data/${f}`);
    continue;
  }
  cpSync(src, join(destDir, f));
  copied += 1;
}
console.log(`sync-public-data: copied ${copied} file(s) to public/data/`);
