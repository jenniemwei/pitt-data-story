# `data/archive/`

This folder holds **older snapshots and files not loaded by the Next.js app** (`dataAssetUrl` / `public/data`). Nothing here is required for a production build of the current routes/coverage UIs.

## Layout

- **`unreferenced/`** — CSVs that were not referenced from `src/`, or join QA exports moved out of `data/join/`. See `unreferenced/README.md` for a per-file “safe to delete?” note.

## Regenerating moved artifacts

- **Join key QA CSVs** (`unreferenced/join-qa-exports/*.csv`): run `python3 scripts/build_join_key_maps.py` to recreate under `data/join/`.
- **FY26 route-finding tables** in `data/fy2026_*.csv` (repo root): run `python3 scripts/generate_fy2026_eliminated_route_findings.py` (writes to `data/`, not this archive).
