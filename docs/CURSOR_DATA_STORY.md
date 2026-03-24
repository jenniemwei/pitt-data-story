# Pitt data story — context for Cursor

**Findings and data quality:** in-repo [FINDINGS_LOG.md](FINDINGS_LOG.md) · [DATASET_LIMITATIONS.md](DATASET_LIMITATIONS.md) (pros/cons per source). **FY2026 eliminated routes (ACS + weekday ridership):** `data/fy2026_eliminated_route_findings.csv` (regenerate with `scripts/generate_fy2026_eliminated_route_findings.py`).

## Repo anchors

| Item | Path |
|------|------|
| Step 1 — filtered ACS neighborhoods + hood crosswalk + per-route stops | `data/neighborhood_profiles_neighborhood.csv`, `data/neighborhood_hood_crosswalk.csv`, `data/route_stop_per_route.csv` (build: `scripts/normalize_geography_step1.py`) |
| FY2026 route cuts (tabular) | `data/prt_fy2026_route_cuts.csv` |
| FY2026 eliminated routes — table (one row per route) | `data/fy2026_eliminated_route_findings.csv` |
| Build script (cuts CSV) | `scripts/build_prt_fy2026_route_cuts.py` |
| Generator (eliminated-route table) | `scripts/generate_fy2026_eliminated_route_findings.py` |
| Primary join key to other datasets | `ridership_route_code` (plus human `route`) |

## Analysis goal (one line)

Combine **stop-level usage**, **tract demographics** (income and related), and **route-level cut exposure** to highlight where transit-dependent riders may be most affected.

## Implementation order (short)

1. Keep route cuts reproducible from the official memo via the build script.
2. Ingest stop usage and normalize stop IDs and dates.
3. Load ACS (or chosen) demographics at tract/block group; document year and table IDs in `FINDINGS_LOG.md` or the relevant script note.
4. Spatial join: stops → tracts; aggregate usage; attach routes at stops (e.g. GTFS); merge cuts by `ridership_route_code`.
5. Build tract- or stop-level scores (dependence × vulnerability × exposure); export CSV/GeoJSON + data dictionary.

When in doubt, document joins and caveats in `FINDINGS_LOG.md` and `DATASET_LIMITATIONS.md`.
