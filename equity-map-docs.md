# Equity Map Build Log

## Map copy and neighborhood fill (V score)

- **Side panel — transit metric** is labeled **% workers relying on PRT for commute** for the story. The underlying field remains ACS **workers commuting by public transportation** (all regional operators, not PRT-only).
- **Neighborhood fill** is driven by the **vulnerability score V** (0–100), not by transit alone. **Poverty** contributes to V via ranked `below_poverty_pct` (see below); the hover panel still shows poverty explicitly.
- **Style guide — fill by V**
  - **V ≥ 60 (high):** `#FF6B6B`
  - **V ≥ 40 (moderate):** `#FFA883`
  - **V &lt; 40 (low):** `#EEEAE1`
  - **Water:** `#999999` when a polygon is water-only (`aland10 === 0`, `awater10 > 0`) in `neighborhoods.geojson` (currently rare / unused).
- **Style guide — neighborhood outline:** `#C8C8C8`, **2px**, drawn **above** route lines so boundaries stay legible.
- **Style guide — routes (after cuts),** all at **50% line opacity** so overlaps stack:
  - **No impact / existing:** `#1D7B96`, **4px** solid
  - **Stop reduction:** **4px** dashed, black (`major_frequency_reduction` → `route_visual` `stop_reduction`)
  - **Hours & stop reduction:** **2px** dashed black (`shortened_alignment` → `hours_stop_reduction`)
  - **Hours reduction:** **2px** solid black (`reduced_hours_11pm` → `hours_reduction`)
  - **Elimination:** **4px** solid white
- **Before/after toggle:** **Before** shows all lines as **4px** solid teal `#1D7B96` at the same opacity (pre-cut context).

## Vulnerability score V (implemented)

**Module:** `src/lib/equity-map/vulnerabilityScore.js` (with `src/lib/equity-map/constants.js` for route ID normalization).

Composite **neighborhood-level** score from three ranked pillars, **midrank** `((index + 0.5) / N)` after sorting ascending within the profile universe (`fy26_route_n_profiles_all.csv`).

1. **Economic stress (E)** — rank of `below_poverty_pct` (higher poverty → higher rank).
2. **Transit reliance (T)** — rank of `transit_dependent_pct_proxy`.
3. **Post-COVID ridership stress (R)** — `g_r = pct_change_weekday_riders_recent_vs_baseline` from `FY26_route_status_all.csv` for each route in `routes_before`;  
   `stress_r = clamp(0, max(0, −g_r) / 100, 1)`; **`R_raw` = mean** of `stress_r` over matched routes; **R** = rank of `R_raw` (weak recovery → higher rank).

**Composite:**  
`V = 0.35·E + 0.35·T + 0.30·R`, reported as **`round(100 × V)`** on **0–100**.

**Filter toggle:** “Show only …” uses **V ≥ 40** and **route access lost ≥ 25%** (`routes_losing_count / routes_before_count`).

**Note:** Polygons whose `hood` has no profile row get **V = 0** until joined.

## Project goal
Build an interactive equity map with:
- Neighborhood choropleth by **vulnerability score V**
- Route overlays for no-change / reduced / eliminated
- Reduced-route subencoding (frequency vs reduced-hours vs shortened alignment)
- Hover panel metrics and featured neighborhood highlighting

## Status snapshot
- Mapping library: `mapbox-gl` installed by user
- Neighborhood geometry: available at `data/neighborhoods.geojson`
- Route geometry: available at `data/route_lines_current.geojson`
- Transit source data: available at `data/GTFS/` (`routes.txt`, `trips.txt`, `shapes.txt`, etc.)
- Route status/cut data: available at:
  - `data/FY26_route_status_all.csv`
  - `data/primary/prt_fy2026_route_cuts.csv`
  - `data/fy26_route_n_profiles_all.csv`

## Steps completed so far
1. Confirmed core data files exist for route status and neighborhood profiles.
2. Confirmed neighborhood geometry is present (`data/neighborhoods.geojson`).
3. Confirmed GTFS route key source is present (`data/GTFS/routes.txt`).
4. Confirmed route key distinction requirements from data:
   - `069` (local) and `P69` (commuter flyer) are separate and must remain separate.
5. Updated planning framework to:
   - Count `retained_equity` as `no_change`
   - Add reduced-route subencoding categories:
     - `major_frequency_reduction`
     - `reduced_hours_11pm`
     - `shortened_alignment`
6. Bootstrapped React + Vite app shell in repo:
   - `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/styles.css`
   - Added npm scripts (`dev`, `build`, `preview`) in `package.json`
7. Implemented first-pass `EquityMap` React component:
   - file: `src/components/EquityMap.jsx`
   - loads neighborhood GeoJSON + profile/status CSV
   - joins neighborhood metrics to polygon properties for hover panel
   - supports before/after toggle, high-dependency filter toggle
   - includes featured outlines for Homewood South + Lower Lawrenceville
   - includes fallback warning if route geometry file is missing
8. Wired route overlay to `data/route_lines_current.geojson`.
9. Added route ID normalization in component join logic:
   - preserves alphanumeric codes (`P69`)
   - normalizes numeric-only IDs (e.g., `069` -> `69`) for geometry/status matching
10. Added styling scaffold split for maintainability:
   - Global token file: `src/styles/tokens.css`
   - Global app/base styles: `src/styles/global.css`
   - Component-specific stylesheet scaffold: `src/components/EquityMap.css`
   - Removed old monolithic `src/styles.css`
11. Migrated map webpage scaffolding to Next.js App Router:
   - `app/layout.js`, `app/page.js`, `app/globals.css`
   - API data route: `app/api/data/route.js` (serves approved files from repo `data/`)
   - Updated scripts in `package.json` to `next dev/build/start`
   - Updated map token env var to `NEXT_PUBLIC_MAPBOX_TOKEN`
12. Consolidated style architecture and removed redundancy:
   - `app/globals.css` now contains only global tokens + base/page-level styles
   - Moved equity-map styling into component-scoped CSS module:
     - `src/components/interactive/data-viz/equity-map/EquityMap.module.css`
   - Removed redundant legacy style files:
     - `src/styles/global.css`
     - `src/styles/tokens.css`
     - `src/components/EquityMap.css`
13. Reorganized component structure for future scrollytelling:
   - Data viz components:
     - `src/components/interactive/data-viz/equity-map/EquityMap.jsx`
     - `src/components/interactive/data-viz/index.js`
   - Motion/scroll components:
     - `src/components/interactive/motion/scroll-scene/ScrollScene.jsx`
     - `src/components/interactive/motion/index.js`
   - Scroll utility:
     - `src/lib/scrollama/useScrollama.js`
14. Set up `scrollama` dependency and scaffold integration points for scene-based storytelling.
15. Implemented **Vulnerability score** end-to-end and **style-guide** symbology:
    - `computeVScoreMap` + shared `normalizeRouteId` / `ROUTE_ALIAS_MAP`
    - Fill by V thresholds; route `route_visual` mapping; outlines **after** routes
    - Legend and hover show **V**; filter uses V + access loss

## Join-key alignment requirements

### Route join keys
- Use string-based canonical IDs; never cast to numeric globally.
- Normalization rule:
  - trim and uppercase
  - strip leading zeros only for all-digit codes when mapping to GTFS route IDs (example: `069` -> `69`)
  - preserve alphanumeric prefixes (`P69` stays `P69`)
- Explicitly preserve distinction:
  - `069` != `P69`

### Neighborhood join keys
- Primary geometry property in `data/neighborhoods.geojson`: `hood`
- Build crosswalk from profile neighborhood names (`fy26_route_n_profiles_all.csv`) to `hood`
- Use normalized text matching first (case, punctuation, spacing), then manual overrides

## Route lines file requirements
- Preferred target: `LineString`/`MultiLineString` GeoJSON per route with:
  - `route_id` (canonical join key)
  - `route_name`
  - optional `direction`, `variant`, `shape_id`
- If route geometry is not yet exported, generate from GTFS:
  - `routes.txt` + `trips.txt` + `shapes.txt`
  - choose representative shape per route or keep variant features

## Planned output files (alignment + map payload)
- `data/join/route_key_map.csv`
- `data/join/neighborhood_key_map.csv`
- `interactive/equity-map/data/routes_lines.geojson` (or before/after split)
- `interactive/equity-map/data/neighborhoods.geojson` (enriched properties)
- `interactive/equity-map/data/route_status_enriched.json` (optional)

## Execution checklist (next)

### A. Join-key maps
- [x] Build `route_key_map.csv` from `FY26_route_status_all.csv` and route geometry keys
- [x] Build `neighborhood_key_map.csv` from profile neighborhoods and GeoJSON `hood`
- [x] Export unmatched rows for manual review

### B. Route geometry payload
- [x] Confirm dedicated route-lines GeoJSON exists (`data/route_lines_current.geojson`)
- [ ] Derive missing route variants or add alias mappings for unmatched codes
- [ ] Add explicit canonical `route_id` field to geometry (currently using normalized `route_code`)

### C. Final map-ready data
- [x] Join route status to route geometry in component runtime
- [x] Encode primary status (`no_change` / `reduced` / `eliminated`)
- [x] Add reduced-route subtype and stroke pattern in map styling
- [x] Join neighborhood metrics to polygons in component runtime

## QA results (latest)

### Build/runtime QA
- `npm run build` passes successfully (Vite production build).
- No linter diagnostics in edited files.

### Data join QA artifacts generated
- `data/join/route_key_map.csv`
- `data/join/route_key_map_unmatched.csv`
- `data/join/neighborhood_key_map.csv`
- `data/join/neighborhood_key_map_unmatched.csv`

### Join coverage summary
- Route join map: `100 total`, `100 matched`, `0 unmatched` (after alias crosswalk update).
- Neighborhood join map: `50 total`, `50 matched`, `0 unmatched`.
- Route distinction handling remains explicit: `069` and `P69` are treated as separate keys.

### Alias crosswalk applied
- Legacy/variant route keys normalized via alias map in:
  - `scripts/build_join_key_maps.py`
  - `src/lib/equity-map/constants.js` (imported by `EquityMap.jsx`)
- Aliases include:
  - `019L -> 19L`, `051L -> 51L`, `052L -> 52L`, `053L -> 53L`
  - `028X -> 28X`
  - `061A/B/C/D -> 61A/B/C/D`
  - `071A/B/C/D -> 71A/B/C/D`
  - `BLLB -> BLUE`, `BLSV -> BLUE`
  - `000` and `0` -> `MI`

## Next steps (prioritized)
1. Materialize a pre-joined map payload file (`route_status_enriched.json` or enriched route GeoJSON) to reduce runtime join logic (include precomputed `v_score`).
2. Add QA note snapshots in this document after each data-refresh run.
3. Optional perf pass: split map bundle/lazy-load map component to reduce initial JS payload.
4. Optional: dedupe `ROUTE_ALIAS_MAP` between Python script and `constants.js` via generated JSON.

## Notes for component-level tracking
- Component 1: Data prep pipeline
  - Inputs: GTFS + FY26 status + neighborhood profiles + neighborhood GeoJSON
  - Outputs: key maps + enriched GeoJSON/JSON
- Component 2: Map rendering
  - Inputs: map-ready GeoJSON/JSON
  - Outputs: choropleth + overlays + legends + controls
- Component 3: Interaction layer
  - Inputs: joined properties for hover/filter/toggle
  - Outputs: side panel, filter states, featured outlines

## Blockers
- Route-key artifacts and aliases are now resolved at full match coverage.
- Remaining polish: optional pre-joined payload export; water polygons may need a dedicated source if the basemap should match `#999999` fill for rivers.
