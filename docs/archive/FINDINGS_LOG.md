# Findings log — Pitt data story

Use this file as the **running record** of trends, hypotheses, and conclusions. Every entry must be **reproducible**: steps, numbers, file/table references, and **documented joins or table actions**. See [DATASET_LIMITATIONS.md](DATASET_LIMITATIONS.md) for caveats by source.

**Cursor rule:** When editing `docs/`, `data/`, or `scripts/`, follow [.cursor/rules/pitt-data-story-findings.mdc](../.cursor/rules/pitt-data-story-findings.mdc).

---

## How to add an entry

1. Copy the **template** below into a new section under [Log entries](#log-entries) (newest entries on top unless you prefer chronological bottom-up — stay consistent).
2. Fill every subsection. If a subsection does not apply, write `N/A` and why.
3. For any combined dataset, the **Joins and table actions** section is mandatory.

---

## Template (copy from the next line through the horizontal rule)

```markdown
### [FIND-YYYYMMDD-##] Short title

| Field | Value |
|-------|--------|
| **Status** | draft / ready / published / superseded |
| **Date** | YYYY-MM-DD |
| **Author** | optional |

**Research question**

One sentence.

**Steps taken (reproducible)**

1. …
2. …

**Key numbers**

- Metric: value — units, geography, time range.
- Cite source: column names, filter, or export filename.

**Tables and files referenced**

- `path/or/url` — what was read (and rows/columns if helpful).
- …

**Joins and table actions**

Document every merge, filter, aggregation, and spatial step in order.

| Step | Operation | Left input (grain) | Right input (grain) | Keys / predicate | Notes |
|------|-----------|--------------------|--------------------|------------------|-------|
| 1 | e.g. INNER JOIN | … (route) | … (route) | `ridership_route_code` | … |
| 2 | e.g. GROUP BY | … | — | … | … |
| 3 | e.g. spatial: point in polygon | stops (point) | tracts (polygon) | CRS: … | … |

If using SQL or pandas only, you may replace the table with a numbered list that includes **grain** and **keys** for each step.

**Outputs**

- Figures, CSVs, notebook paths, or other outputs.

**Limitations and sensitivity checks**

- Tie to [DATASET_LIMITATIONS.md](DATASET_LIMITATIONS.md) where relevant.
- Alternative definitions or robustness checks tried or planned.

**Next checks**

- …

---
```

---

## Log entries

### [FIND-20260324-02] Step 1 geography normalization (profiles filter, hood crosswalk, per-route stops)

| Field | Value |
|-------|--------|
| **Status** | draft |
| **Date** | 2026-03-24 |

**Research question**

How do we align `neighborhood_profiles.csv` neighborhood names with `route-stop-table.csv` `hood` labels and produce one row per stop × route for trip aggregation?

**Steps taken (reproducible)**

1. Run `python3 scripts/normalize_geography_step1.py` (writes outputs below).

**Key numbers**

- `neighborhood_profiles_neighborhood.csv`: **50** rows (`GeographyType = neighborhood`).
- `neighborhood_profiles_neighborhood_group.csv`: **16** rows (`GeographyType = neighborhood group`).
- `neighborhood_hood_crosswalk.csv`: **187** unique `(muni, hood, munihood_display)` combinations from the route-stop table.
- `route_stop_per_route.csv`: **11,063** rows (drops `route_sort = 00` aggregate rows; adds `route_id` = `route_sort`).

**Tables and files referenced**

- `data/neighborhood_profiles.csv` — source ACS extracts.
- `data/neighborhood_hood_crosswalk_overrides.csv` — explicit `hood` → `NeighborhoodGroup` for the **39** city neighborhoods not in the 50 neighborhood-level rows (maps to **16** neighborhood-group rows).
- `data/route-stop-table.csv` — source stops; per-route grain uses `route_sort` ≠ `00`.

**Joins and table actions**

- **Filter:** `GeographyType` ∈ {`neighborhood`, `neighborhood group`} → two separate exports; story grain remains **neighborhood** (50) with **group** (16) only where `match_method = override_csv` on the crosswalk.
- **Crosswalk grain:** one row per distinct service geography key from the route table (`muni`, `hood`, `munihood_display`). Pittsburgh city: `hood` matching one of the **50** `NeighborhoodGroup` names → `GeographyType = neighborhood`; else lookup `neighborhood_hood_crosswalk_overrides.csv` → `GeographyType = neighborhood group`; non-Pittsburgh → `GeographyType = none` (no ACS row).
- **Route parsing:** filter out rows with `route_sort = 00`; retain one row per physical stop × route with trip columns (`trips_*`) for that route only.

**Outputs**

- `data/neighborhood_profiles_neighborhood.csv`
- `data/neighborhood_profiles_neighborhood_group.csv`
- `data/neighborhood_hood_crosswalk.csv`
- `data/route_stop_per_route.csv`

**Limitations and sensitivity checks**

- Chateau maps to `East Allegheny-North Shore` (neighborhood group) as a geographic proxy; see `notes` in overrides CSV.
- Suburban and out-of-city rows have no `NeighborhoodGroup` in this crosswalk (`outside_city_profiles`).

**Next checks**

- Optional **route × neighborhood** trip sums: `GROUP BY` `route_id`, `hood` on `route_stop_per_route.csv` joined via crosswalk to profiles.

---

### [FIND-20260324] FY2026 eliminated routes — tabular export

| Field | Value |
|-------|--------|
| **Status** | ready |
| **Date** | 2026-03-24 |

**Research question**

For each PRT route proposed for **elimination** in FY2026, what are interpretive neighborhood anchors, **resident** ACS 2022 context (not rider-level), and **weekday** ridership change across COVID-era windows?

**Steps taken (reproducible)**

1. Filter `data/prt_fy2026_route_cuts.csv` to `primary_reduction_action = eliminate`.
2. Map routes to primary neighborhood anchors (`ROUTE_NEIGHBORHOODS` in `scripts/generate_fy2026_eliminated_route_findings.py`).
3. Pull ACS 2022 fields from `data/n_profiles_new.csv`: neighborhood rows (`geography_type = neighborhood`) by `neighborhood_group`, or the **Allegheny County** region row as a suburban proxy when anchors are absent.
4. Mean weekday `avg_riders` by year groups from `data/monthly_avg_ridership.csv` (`day_type = WEEKDAY`).
5. **Count estimates** (rounded integers) beside each resident/household/worker share: race/Hispanic use `affected_total_pop_2022 × pct/100`; top income brackets use summed `income_households_total × pct/100`; below–100% FPL uses summed `poverty_status_determined_pop × pct/100`; commute modes use summed `workers_16_plus × pct/100`.

**Key numbers**

- One row per eliminated route; columns include `affected_total_pop_2022` (sum of `total_pop` from `n_profiles_new` for anchor geography), race/ethnicity and related **population estimates**, household and worker estimates for income/poverty/commute shares, weekday ridership windows, and percent changes vs baseline. Shares align with `n__data_dict.csv` semantics (e.g. `white_alone_share` / `black_alone_share`; public transit = `share_commute_public_transit`; poverty = `share_below_100pct_poverty_threshold`).

**Tables and files referenced**

- `data/fy2026_eliminated_route_findings.csv` — generated output.
- `data/fy2026_reduced_route_findings.csv` — same ACS columns for major/minor reductions (same script).
- `data/n_profiles_new.csv` — ACS source for this export.
- `scripts/generate_fy2026_eliminated_route_findings.py` — regeneration command.

**Joins and table actions**

| Step | Operation | Left (grain) | Right (grain) | Keys |
|------|-----------|--------------|---------------|------|
| 1 | Filter | route cuts | — | `primary_reduction_action = eliminate` |
| 2 | Manual map | route | neighborhood name(s) | `ROUTE_NEIGHBORHOODS` |
| 3 | Lookup ACS | anchor name(s) | neighborhood profile row | `neighborhood_group`; or county row `neighborhood_group = Allegheny County`, `geography_type = region` |
| 4 | Mean weekday ridership | monthly ridership | — | Normalized `ridership_route_code`; `day_type = WEEKDAY` |

**Outputs**

- `data/fy2026_eliminated_route_findings.csv`

**Limitations and sensitivity checks**

- See [DATASET_LIMITATIONS.md](DATASET_LIMITATIONS.md); ACS describes **residents** of anchor geography, not riders.

**Next checks**

- Optional: tract-weighted demographics; GTFS stop catchments.

---

### [EXAMPLE] Placeholder — structure only

| Field | Value |
|-------|--------|
| **Status** | draft |
| **Date** | — |
| **Author** | — |

**Research question**

Replace this block with a real finding; remove this example when the first real entry is added, or keep as a formatting reference.

**Steps taken (reproducible)**

1. N/A — example only.

**Key numbers**

- N/A — example only.

**Tables and files referenced**

- N/A

**Joins and table actions**

| Step | Operation | Left input (grain) | Right input (grain) | Keys / predicate | Notes |
|------|-----------|--------------------|--------------------|------------------|-------|
| — | — | — | — | — | Replace with real steps. |

**Outputs**

- N/A

**Limitations and sensitivity checks**

- Example: see [DATASET_LIMITATIONS.md](DATASET_LIMITATIONS.md) for route vs stop granularity.

**Next checks**

- N/A

---

_Add real findings above this line (newest first recommended)._
