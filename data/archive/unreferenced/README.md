# Unreferenced / archived data

Files moved here are **not fetched by the running app** from `public/data/`. They may still be useful for **documentation, one-off analysis, or Python pipelines**.

## `join-qa-exports/`

| File | Safe to delete? | Notes |
|------|------------------|--------|
| `route_key_map.csv` | **Yes**, if you can rerun `scripts/build_join_key_maps.py` | Join QA; regenerates to `data/join/`. |
| `route_key_map_unmatched.csv` | **Yes** (same) | |
| `neighborhood_key_map.csv` | **Yes** (same) | |
| `neighborhood_key_map_unmatched.csv` | **Yes** (same) | |

## Root of `unreferenced/`

| File | Safe to delete? | Notes |
|------|------------------|--------|
| `homewood_south_vs_lower_lawrenceville_story_data.csv` | **Yes** for app/runtime | Not referenced from `src/`; story / analysis only. |
| `n_group.csv` | **Yes** for app/runtime | Documented in `data/CSV_DATA_GUIDE.md`; not used by `src/` or current scripts (except human inspection). |
| `n_neighborhood.csv` | **Yes** for app/runtime | Same. |
| `n_crosswalk_overrides.csv` | **Yes** for app/runtime | Same. |

## `fy2026-csv-older-snapshots/`

These are **older copies** of the FY2026 finding tables (dated Mar 2026 in git). They **differ** from the current `data/fy2026_*.csv` at repo root (script output).

| File | Safe to delete? | Notes |
|------|------------------|--------|
| `fy2026_eliminated_route_findings.csv` | **Yes** if you keep the root `data/fy2026_eliminated_route_findings.csv` and do not need this snapshot for diff/history. | Deleting only the snapshot is fine for CI/app. |
| `fy2026_reduced_route_findings.csv` | **Yes** (same) | |
| `fy2026_unaffected_route_findings.csv` | **Yes** (same) | |

**Not safe to delete** if this folder is the **only** copy you care about—always compare with root `data/fy2026_*.csv` before removal.
