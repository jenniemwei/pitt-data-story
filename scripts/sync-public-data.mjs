/**
 * Copy approved data files into public/data for Next dev, static export, and GitHub Pages.
 * Keep this allowlist in sync with data consumers (viz components).
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
  "n_profiles_new.csv",
  "neighborhood_display_profiles.csv",
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
