# CSV Data Guide

This file documents what each CSV in `data/` currently contains, using the updated folder structure.

## Top-Level Outputs

- `data/FY26_route_status_all.csv`  
  Combined FY2026 route findings table with one row per route and a `route_status` field (`eliminated`, `reduced`, `unaffected`). Includes route metadata, anchor geography, ACS context fields, and ridership trend fields.

- `data/fy26_route_n_profiles_all.csv`  
  Neighborhood-level summary table covering all neighborhoods in `n_profiles_new.csv` (`geography_type = neighborhood`). Includes service impact status (`fully_cut_off`, `partially_cut_off`, `unaffected`), route counts/lists before and after cuts, and socioeconomic fields (poverty/transit-dependent proxies).

- `data/route_stop_per_route.csv`  
  Stop-level transit table expanded by route-stop combinations (each row is one stop-route record). Used for route-to-neighborhood anchoring via stop geography.

## Primary Source Tables (`data/primary/`)

- `data/primary/prt_fy2026_route_cuts.csv`  
  Canonical FY2026 cut plan input. Contains route IDs, route type, reduction steps, primary action, and method notes from the PRT cuts methodology.

- `data/primary/route-stop-table.csv`  
  Stop inventory table with route context, service stats, and geography tags (`muni`, `hood`, `munihood_display`). Includes both all-route rows and per-route rows.

- `data/primary/daily_ridership_by_stop.csv`  
  Daily ridership observations by stop. Large operational source table used for stop-level ridership analysis.

- `data/primary/monthly_avg_ridership.csv`  
  Monthly average ridership by route/day type. Used for baseline vs. covid vs. recent trend calculations in route findings outputs.

- `data/primary/n__data_dict.csv`  
  Data dictionary/reference for neighborhood profile fields and variable definitions.

- `data/primary/neighborhood_profiles.csv`  
  Neighborhood profile source table (demographic and socioeconomic context), used in profile and summary workflows.

## Archive Outputs (`data/archive/`)

- `data/archive/fy2026_eliminated_route_findings.csv`  
  Archived eliminated-route findings output (pre-combined export).

- `data/archive/fy2026_reduced_route_findings.csv`  
  Archived reduced-route findings output (pre-combined export).

- `data/archive/fy2026_unaffected_route_findings.csv`  
  Archived unaffected-route findings output (pre-combined export).

## Crosswalk / Profile Tables (Top-Level)

- `data/n_profiles_new.csv`  
  Current normalized profile table across region, neighborhood groups, and neighborhoods. Key source for ACS-based contextual fields.

- `data/n_profiles_new_column_map.csv`  
  Field mapping table for `n_profiles_new.csv` transformations/lineage.

- `data/n_crosswalk.csv`  
  Crosswalk linking municipal/neighborhood labels (including city neighborhood names) to `NeighborhoodGroup` and `GeographyType`.

- `data/n_crosswalk_overrides.csv`  
  Manual override mappings for neighborhood/group crosswalk edge cases.

- `data/n_neighborhood.csv`  
  Wide, neighborhood-focused profile/change table with many ACS-derived fields and year-over-year indicators.

- `data/n_group.csv`  
  Neighborhood-group-level profile/change table (aggregated geography).

## Notes

- Route/neighborhood anchor fields in findings outputs are generated from stop geography and crosswalk mapping logic in `scripts/generate_fy2026_eliminated_route_findings.py`.
- Archive files retain older standalone route findings exports; use `data/FY26_route_status_all.csv` for the latest unified route-status view.
