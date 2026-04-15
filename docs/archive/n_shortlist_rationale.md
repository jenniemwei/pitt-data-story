# Neighborhood shortlist rationale

This document explains why the neighborhoods in `[data/n_shortlist.csv](../data/n_shortlist.csv)` were paired, how to read the metrics, and how official FY2026 cut **methodology** relates to places like **Allentown** (eliminated routes + reduced routes in the same neighborhood).

## Data sources


| Purpose                                                                                                      | File                                                                                  |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Neighborhood demographics, poverty, transit-commute proxy, route lists before/after                          | `[data/fy26_route_n_profiles_all.csv](../data/fy26_route_n_profiles_all.csv)`         |
| Weekday ridership **pre-COVID** (2017–2019), **during COVID** (2020–2021), **recent** (2023–2024), per route | `[data/FY26_route_status_all.csv](../data/FY26_route_status_all.csv)`                 |
| Canonical cut actions, methodology step numbers, and memo/PDF reference                                      | `[data/primary/prt_fy2026_route_cuts.csv](../data/primary/prt_fy2026_route_cuts.csv)` |


**Transit “dependency” in the shortlist:** `transit_dependent_pct_proxy` is the share of **workers** who commute by **public transportation** (ACS-based proxy in the neighborhood aggregate), not a full “no car household” measure. Say “transit commute share” where precision matters.

**Ridership in the shortlist:** Values are **sums of system weekday average ridership** for the routes listed in `routes_before` or `routes_losing`, from `FY26_route_status_all.csv`. They approximate “how big those corridors are on paper,” **not** boardings attributed to each neighborhood (that would need stop-level ridership and allocation).

**`example_type` in [`data/n_shortlist.csv`](../data/n_shortlist.csv):** `vulnerable` / `baseline` are the main contrast pair; `vulnerable_few_substitutes` marks neighborhoods where eliminated service is mostly **local/limited routes** or where **few routes remain** after cuts—usually a sharper “no obvious flyer-for-local swap” story than flyer-only losses.

## Flyer eliminations vs “near-substitutes” (e.g. Homewood South)

**Homewood South** (see `fy26_route_n_profiles_all.csv`) **loses seven routes**, all of which are **commuter flyers** (`P12;P16;P67;P69;P7;P71;P76`). It **keeps eight**, including **local / busway**-style service (`071D;074;077;086;P1;P3;P68;P78`).

For several corridors, PRT still runs a **non-flyer** route number that partially overlaps the same regional destination—for example **`P67` (Monroeville Flyer)** is eliminated while **`067` (local Monroeville service)** remains in the system. That does **not** mean the trip is identical (stops, frequency, and walk distance to the corridor often differ), but for storytelling you should **not** frame Homewood South the same way as a pocket that loses **only local span** with no parallel route family. If you want “**fewer alternatives**” in the headline sense, prioritize examples where elimination lists are **numeric locals** (e.g. `026;029`) or **route counts collapse** to one or two (e.g. **cut-off** neighborhoods, or **4 → 2** networks).

## Official methodology PDF

PRT’s published FY2026 cuts memorandum and methodology are cited in this project as:

- **Local copy (expected path):** `[data/primary/methodology.pdf](../data/primary/methodology.pdf)`  
If that file is not present in your clone, download the PDF from the URL below and save it there so documentation and collaborators stay aligned.
- **Same document, as referenced in repo data:** the `source_document` column in `[data/primary/prt_fy2026_route_cuts.csv](../data/primary/prt_fy2026_route_cuts.csv)` points to the PRT-hosted methodology PDF (PRT Planning & Service Development, March 2025 memorandum on proposed February 2026 cuts).

The methodology describes a **sequenced process** (efficiency tiers, duplication, service spans, frequency reductions, “remaining commuter” steps, equity-retained routes, etc.). Your story can cite it for **why** a route was eligible to be cut or reduced, separate from **who** lives along the corridor.

## Why reduced / eliminated service still affects Allentown (methodology-backed)

Allentown’s row is `eliminated;reduced`: some routes are **removed**, others **stay with reductions** (frequency, span, or alignment). Per `fy26_route_n_profiles_all.csv`, before cuts it had routes `043;044;048;051L;054`; **eliminated** from that list are `043` and `051L`; **still present after reduction** are `044;048;054`.

From `[data/primary/prt_fy2026_route_cuts.csv](../data/primary/prt_fy2026_route_cuts.csv)`, the **primary reduction** logic attached to each route includes:


| Route    | Action (summary from `primary_reduction_detail`)                           | Step (`primary_reduction_step`)                                       |
| -------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **043**  | Moderate efficiency local; eliminate                                       | 8                                                                     |
| **051L** | Remaining commuter routes; eliminate                                       | 7                                                                     |
| **044**  | Kohne/Fisher–South Hills Junction only (shorten) + systemwide cuts per row | 3 (+ night end / major frequency in `all_reduction_actions_in_order`) |
| **048**  | End all bus, light rail, and incline service at 11:00 p.m. daily           | 4                                                                     |
| **054**  | Major frequency reduction                                                  | 6                                                                     |


So Allentown is a strong illustration for a visualization: **the same neighborhood** can lose **entire routes** (43, 51L) *and* face **harder-to-notice** cuts (later nights, less frequency, shortened alignment) on others—still grounded in the methodology PDF / memo process, not in ridership alone.

## Pairings (population- and context-matched)

### Pair A — **Allentown** (vulnerable) vs **Point Breeze North** (baseline)


| Dimension                                 | Allentown | Point Breeze North |
| ----------------------------------------- | --------- | ------------------ |
| Population (2022 ACS in profile)          | 1,966     | 1,884              |
| `below_poverty_pct`                       | ~24.9%    | ~6.7%              |
| `transit_dependent_pct_proxy`             | ~23.7%    | ~10.5%             |
| Eliminated routes (`routes_losing_count`) | 2         | 0                  |
| `routes_before` count                     | 5         | 8                  |


**Rationale:** Very similar **population size**; comparable **order of magnitude** of route exposure (5 vs 8 routes). The contrast is **vulnerability** (poverty + transit commute share) plus **direct elimination** of two routes in Allentown vs none eliminated in Point Breeze North, while both remain in the “reduced service” bucket at the neighborhood tag level.

### Pair B — **East Hills** (vulnerable) vs **Morningside** (baseline)


| Dimension                     | East Hills | Morningside |
| ----------------------------- | ---------- | ----------- |
| Population                    | 3,505      | 3,301       |
| `below_poverty_pct`           | ~48.7%     | ~3.7%       |
| `transit_dependent_pct_proxy` | ~15.5%     | ~8.4%       |
| `routes_losing_count`         | 1 (`P17`)  | 0           |
| `routes_before` count         | 5          | 2           |


**Rationale:** Matched population; East Hills is a **high-poverty** contrast to a **low-poverty** neighbor with a **smaller** route set (honest limitation: 5 vs 2 routes—call out in the chart). Good for “one eliminated flyer vs stable local routes” stories.

### Pair C — **Lincoln-Lemington-Belmar** (vulnerable) vs **Stanton Heights** (baseline)


| Dimension                     | Lincoln-Lemington-Belmar | Stanton Heights |
| ----------------------------- | ------------------------ | --------------- |
| Population                    | 4,485                    | 4,555           |
| `below_poverty_pct`           | ~32.6%                   | ~9.8%           |
| `transit_dependent_pct_proxy` | ~25.8%                   | ~9.3%           |
| `routes_losing_count`         | 2                        | 0               |
| `routes_before` count         | 8                        | 3               |


**Rationale:** Extremely tight **population** match; vulnerability contrast is sharp. Route-network **size differs** (8 vs 3)—use as a labeled caveat, or encode “routes before” on the chart so viewers see both dimensions.

### Pair D — **Larimer** (vulnerable) vs **Lower Lawrenceville** (baseline)


| Dimension                     | Larimer        | Lower Lawrenceville |
| ----------------------------- | -------------- | ------------------- |
| Population                    | 1,574          | 2,448               |
| `below_poverty_pct`           | ~41.1%         | ~14.5%              |
| `transit_dependent_pct_proxy` | ~22.6%         | ~9.9%               |
| `routes_losing_count`         | **9**          | **0**               |
| `routes_before` count         | 23             | 7                   |


**Rationale:** Strongest **elimination asymmetry** on the shortlist (nine entire routes removed vs none). Poverty and transit-commute gaps are both wide. **Caveats:** Larimer is a **high route-count** hub (many overlapping corridors through one area)—say so in copy so it does not read as “Larimer is unique” without context. Populations are in the same ballpark but not as tight as Pair A.

### Pair E — **Crafton Heights** (vulnerable) vs **Lower Lawrenceville** (baseline)


| Dimension                     | Crafton Heights | Lower Lawrenceville |
| ----------------------------- | --------------- | ------------------- |
| Population                    | 3,951           | 2,448               |
| `below_poverty_pct`           | ~26.5%          | ~14.5%              |
| `transit_dependent_pct_proxy` | ~13.5%          | ~9.9%               |
| `routes_losing_count`         | **2**           | **0**               |
| `routes_before` count         | 4               | 7                   |
| `routes_after` count          | 2               | 7                   |


**Rationale:** Better fit for a “lost local access” story than flyer-heavy cuts: Crafton Heights loses two local routes (`026`, `029`) and is left with two routes, while Lower Lawrenceville keeps all seven routes (reduced but not eliminated). Poverty and transit-commute gaps remain meaningful, and the pairing avoids over-relying on commuter-flyer eliminations.

### Pair F — **West End** (`vulnerable_few_substitutes`) vs **Morningside** (baseline)


| Dimension                     | West End                          | Morningside        |
| ----------------------------- | --------------------------------- | ------------------ |
| Population                    | 2,712                             | 3,301              |
| `below_poverty_pct`           | ~18.1%                            | ~3.7%              |
| `transit_dependent_pct_proxy` | ~6.5%                             | ~8.4%              |
| `routes_losing`               | **026;029;038** (all non-`P`/`Y`) | *(none eliminated)* |
| `routes_before` → `routes_after` | **5 → 2**                         | **2 → 2**          |


**Rationale:** **Three local/regional bus eliminations** and the neighborhood ends with **only two routes** (`027;031`). Compared with Homewood South, there is **no** “drop the flyer but keep the local with the same number” pattern on this list—the losses are **`026` / `029` / `038`** themselves. **Caveat:** poverty is lower than Larimer/Central Oakland; the hook is **network thinning** + elimination count, not the highest poverty pocket on the map.

### Pair G — **Summer Hill** (`vulnerable_few_substitutes`) vs **Lower Lawrenceville** (baseline)


| Dimension                     | Summer Hill                     | Lower Lawrenceville |
| ----------------------------- | ------------------------------- | ------------------- |
| Population                    | 2,996                           | 2,448               |
| `below_poverty_pct`           | **~42.4%**                      | ~14.5%              |
| `transit_dependent_pct_proxy` | ~15.0%                          | ~9.9%               |
| `routes_losing`               | **004;007;O12;O5**              | *(none eliminated)* |
| `routes_before` → `routes_after` | **7 → 3**                   | **7 → 7**           |


**Rationale:** **High poverty** plus **four eliminated routes** (mix of **locals** and **flyers** `O12`/`O5`). Baseline keeps **all seven** routes (frequency/span cuts only). Strong **vulnerability × elimination** contrast; still note **O12/O5** are flyers so one sentence on “remaining corridor service” may apply—check `routes_after` (`006;012;015`) for what stays.

### Pair H — **Manchester** (`vulnerable_few_substitutes`) vs **Bloomfield** (baseline)


| Dimension                     | Manchester           | Bloomfield          |
| ----------------------------- | -------------------- | ------------------- |
| Population                    | 3,011                | 8,916               |
| `below_poverty_pct`           | ~16.2%               | ~11.2%              |
| `transit_dependent_pct_proxy` | ~6.1%                | ~15.0%              |
| `routes_losing`               | **014;018**          | *(none eliminated)* |
| `routes_before` → `routes_after` | **4 → 2**        | **11 → 11**         |


**Rationale:** **Losses are locals** (`014` Ohio Valley, `018` Manchester)—no `P`/`Y` flyer in the elimination list—so the “substitute” story is weaker than Homewood’s flyer bundle. **Caveat:** Bloomfield is **larger** and busier on paper (11 routes); use as a **Northside vs East End** baseline only if you label population and route-count differences in the graphic.

### Other “few alternatives” options (not yet on `n_shortlist.csv`)

From the same neighborhood table, consider citing in copy or a second tier:

- **East Allegheny:** loses `002;004;007`, **11 → 8** routes, `below_poverty_pct` ~25.8%.
- **Chateau:** loses `014;018;SLVR`, **6 → 3** routes—very thin **after** network (rail `BLUE`/`RED` remain).
- **Cut-off** neighborhoods (**Banksville**, **Duquesne Heights**): **after = 0** for the last route—total loss of listed service—but poverty is relatively low; better as **controls** than as vulnerable exemplars unless you branch.

## Which pair to feature? (ranking)

Use this when choosing a **primary** two-neighborhood spine for scrollytelling (low income vs higher income, disparate cuts).

1. **Summer Hill + Lower Lawrenceville (Pair G)** — Best combined **high poverty** + **multiple eliminations** + **large drop in route count** (7 → 3) vs a baseline that **loses zero routes** (7 → 7). Use when you want “few alternatives” without leaning on Homewood-style flyer substitution.

2. **Crafton Heights + Lower Lawrenceville (Pair E)** — Same “**local eliminations** + **4 → 2**” logic as before; still top-tier for the “not just flyers” angle.

3. **West End + Morningside (Pair F)** — Strong **three local eliminations** + **5 → 2** network collapse; poverty contrast is moderate.

4. **Larimer + Lower Lawrenceville (Pair D)** — Strongest raw elimination-count contrast (9 vs 0), but much denser route geography in Larimer (23 routes before) can blur the “no alternatives” framing.

5. **Manchester + Bloomfield (Pair H)** — Excellent **local-only** elimination list; weaker population/route comparability—label clearly.

6. **Allentown + Point Breeze North (Pair A)** — Best “clean” demographic + scale match already documented with methodology callouts; elimination contrast is real but milder (2 vs 0).

7. **Lincoln-Lemington-Belmar + Stanton Heights (Pair C)** — Excellent population match and 2 vs 0 eliminations; route-count asymmetry (8 vs 3) should be labeled.

8. **East Hills + Morningside (Pair B)** — Strong poverty contrast (~49% vs ~4%) but weaker elimination gap (1 vs 0) and route comparability (5 vs 2).

9. **Homewood South** — Strong demographics but **flyer-heavy** losses; pair only if narrative explains **remaining locals / busway** and possible **non-flyer** corridor cousins (e.g. **67** vs **P67**), not “transit deserts overnight.”

## Data limitations (shortlist)

1. **Missing route in FY26 table:** `079` appears in some neighborhood `routes_before` lists (`East Hills`, `Lincoln-Lemington-Belmar`) but has **no row** in `FY26_route_status_all.csv`, so ridership sums use **one fewer route** than `routes_before_count`. See `ridership_routes_before_missing_codes` in the CSV.
2. **Demographics ≠ riders:** ACS describes **residents** of the neighborhood; riders may come from elsewhere.
3. **Summed route ridership** is a **corridor-scale** proxy, not neighborhood stop-level O-D.

## Files to cite in a viz footnote

- `[data/n_shortlist.csv](../data/n_shortlist.csv)` — curated examples + ridership sums  
- `[data/primary/methodology.pdf](../data/primary/methodology.pdf)` — official cut methodology (or PRT URL via `prt_fy2026_route_cuts.csv` `source_document`)  
- `[data/primary/prt_fy2026_route_cuts.csv](../data/primary/prt_fy2026_route_cuts.csv)` — route-level action and step text for callouts (e.g. Allentown’s routes)

