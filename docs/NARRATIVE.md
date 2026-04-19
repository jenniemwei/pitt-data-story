# Equal Cuts, Unequal Consequences

**Editorial narrative for the Pittsburgh transit story.**
Data sources: `FY26_route_status_all.csv`, `fy26_route_n_profiles_all.csv`, `route_stop_per_route.csv`. Persona copy: `src/data/copy/personaJourneyCopy.js`. Viz assembly: `src/data/narrative.js`. Rider totals: PRT FY2023 Annual Service Report (~120k daily riders); route-sum baseline ~223k weekday avg from `FY26_route_status_all.csv`.

---

## The story in one breath

**PRT ranks every route by ridership efficiency — the same rule for everyone. Routes that serve the poorest, most transit-dependent neighborhoods often have the lowest scores — not because people abandoned the bus, but because the system already left them with the least.**

Efficiency on a spreadsheet erases history: past cuts, thin headways, and who never had a car. FY26 proposes 41 eliminations and 57 reductions. The metric looks neutral. The outcomes are not.

---

## Chapter 1 — Scale

**Corridors through higher-poverty neighborhoods often shrank less than wealthier ones — then turned up at the bottom of the same efficiency list.**

Every weekday about **120,000** people board a PRT bus, train, or incline (PRT FY23 ASR). That is down from roughly **220,000** weekday average boardings in the FY26 route dataset’s 2017–19 baseline — a system running at about half its old volume. For some riders, transit is a convenience. For others it is the only way to work, school, or a doctor. Corridors serving higher-poverty neighborhoods show a transit-commute proxy of roughly **15–26%** of workers; in lower-poverty areas it drops to roughly **7–10%**. The gap is not taste. It is access.

**Key figures**
- ~120,000 typical weekday PRT riders (published + dataset sum ~118.5k recent)
- ~223,000 weekday average boardings summed across routes at pre-pandemic baseline (dataset)
- Poverty-tier transit proxy splits as above (`fy26_route_n_profiles_all` / route table)

`[DATA VIZ: opening scale — baseline vs recent riders → transit-dependence split]`

---

## Chapter 2 — Two mornings, before anything changes

**Meet two commuters the spreadsheet never names — same metropolitan system, opposite leverage — before a single FY26 vote.**

Before talking about cuts: **Marcus** (choice rider, Stanton Heights, pop. 4,555 — 9.8% poverty, 9.3% transit-commute proxy, household has a car) walks 6 min to the 71B, rides 26 min to Downtown, walks 6 min to the office — **38 min** total. He rides because it beats parking ($14–18/day). If the bus fails, he drives. **Denise** (dependent rider, Lincoln-Lemington–Belmar, pop. 4,485 — 32.6% poverty, 25.8% transit proxy, no household car) does kid drop at Lincoln K-8, walks to WASHINGTON BLVD AT HIGHLAND DR (stop E56360, P10 only), rides inbound, walks to her shift — **54 min** to clock-in. She rides because there is no alternative.

**Two neighborhoods, nearly identical populations. 3.3× poverty gap. 2.8× transit-dependence gap.**

`[DATA VIZ: PersonaDayCard — phase "before" — side-by-side journey comparison]`

---

## Chapter 3 — The FY26 proposal

**Forty-one routes gone. Fifty-seven thinned. One efficiency column decides who stays.**

PRT’s FY26 scenario (this build):

| | Count |
|---|---|
| **Routes proposed for elimination** | 41 |
| **Routes proposed for reduction** | 57 (28 major, 29 minor) |
| **Routes unchanged** | 3 |

Rank routes by riders-per-revenue-hour; cut the bottom. On paper every row is equal. No column says *neighborhood* or *poverty*. But efficiency inherits the network it measures: years of thinner service yield lower counts; lower counts trigger the next cut.

`[DATA VIZ: FY26PlanStats — 41 / 57 / 3 stat blocks]`

---

## Chapter 4 — Same crisis, two corridors

**One pocket keeps every line and a future BRT spine. The other loses a stop off the map.**

**71B (Marcus):** Minor reduction; University Line BRT; Rt **089** retained for equity — **all 3** Stanton Heights routes survive. Recent weekday riders ~3,958 vs ~5,020 baseline (−21%). **P10 (Denise):** Eliminated; “commuter flyer” label but a curb at **40.474°N**, no park-and-ride; **E56360** orphaned — no other route. **7 of 8** LLB routes cut or eliminated; only **079** untouched. P10 ~221 recent vs ~698 baseline (−68%).

| | Stanton Heights (Marcus) | Lincoln-Lemington–Belmar (Denise) |
|---|---|---|
| Population | 4,555 | 4,485 |
| Poverty rate | 9.8% | 32.6% |
| Transit-commute proxy | 9.3% | 25.8% |
| Routes before FY26 | 3 | 8 |
| Routes eliminated | 0 | 2 |
| Routes major-reduced | 2 | 5 |
| % routes impacted | 66.7% | 87.5% |
| Route retained for equity | 089 | — |

Same fiscal pressure. Same methodology. Trim plus investment on one side; elimination plus compounding reductions on the other.

`[DATA VIZ: CorridorScrollMap — poverty → transit dependence → FY26 outcomes]`

`[DATA VIZ: ScrollDemographics — abstract divergence, 71B vs P10]`

---

## Chapter 5 — After the cuts

**He loses six minutes and a parking debate. She loses the stop, then the shift.**

**Marcus:** Same 71B stop; ~**44 min** total (+6); minor frequency pain; drive still ~20 min. **Denise:** P10 gone at E56360; ~**7 min** walk to major-reduced **74**; **89+ min** home to work; late clock-in and disciplinary risk; quarterly doctor trips harder on thinner routes.

Same kid, same employer clock, no mercy for a eliminated corridor.

`[DATA VIZ: PersonaDayCard — phase "after" — side-by-side journey comparison]`

---

## Chapter 6 — Trip purpose

**PRT doesn’t publish why people ride — but the jobs along the line tell you who can’t stay home.**

Industry mix proxies **choice** vs **need**: 71B aligns with more office and professional employment; P10’s corridor tilts toward healthcare, retail, education, and food service — work that doesn’t remote. Denise’s trip isn’t discretionary; it’s how the city keeps hospitals staffed and shelves stocked.

`[DATA VIZ: TripPurposeProxy — 71B "choice" vs P10 "need"]`

---

## Chapter 7 — The numbers beneath the numbers

**High-poverty corridors didn’t bounce back less — across this dataset they often lost a *smaller share* of old ridership than low-poverty corridors. Cuts still target the bottom of the efficiency list.**

PRT’s framework rarely asks: *what if today’s low ridership is yesterday’s disinvestment?* Among **reduced** routes, average recovery vs 2017–19 baseline is **−29.8%** for high-poverty segments vs **−38.4%** for low-poverty (tier cuts in [Chapter 7 tables below](#ridership-recovery-tables)). Across **all** routes in the file, high-poverty tier averages **−32.8%** vs **−51.8%** for low-poverty — a **19 point** gap; dependent riders often had nowhere else to go.

**The cycle:** disinvestment → thinner ridership counts → efficiency ranking → deeper cuts where dependence is highest → repeat on a smaller network.

This is not “every eliminated route must stay.” It is: **equal rules, unequal human cost** — ridership-based decisions may be formally equal and materially inequitable for riders PRT exists to serve first.

`[DATA VIZ: Ridership Recovery — new viz — recovery by poverty tier]`

### Ridership recovery tables {#ridership-recovery-tables}

Among **reduced** routes:

| Poverty tier | Routes | Avg recovery (recent vs 2017–19 baseline) |
|---|---|---|
| High poverty (>25%) | 26 | **−29.8%** |
| Mid poverty (15–25%) | 12 | −37.9% |
| Low poverty (<15%) | 11 | −38.4% |

Across **all** routes:

| Poverty tier | Routes | Avg recovery |
|---|---|---|
| High poverty (>25%) | 31 | **−32.8%** |
| Low poverty (≤15%) | 47 | −51.8% |

---

## Chapter 8 — The map

**Poverty and transit dependence stack on the same dots — and the biggest, darkest clusters sit where routes disappear.**

Regional canvas: color = poverty intensity, dot size = transit dependence; FY26 route styling shows the pattern isn’t two neighborhoods — it’s structural.

`[DATA VIZ: EquityMap3 — bivariate dot map + FY26 routes]`

---

## Story arc (reader order)

| # | Headline theme | Viz |
|---|----------------|-----|
| 1 | Scale + paradox opening | StoryOpening |
| 2 | Two mornings, before cuts | PersonaDayCard (before) |
| 3 | FY26 counts | FY26PlanStats |
| 4 | Same crisis, two corridors | CorridorScrollMap + ScrollDemographics |
| 5 | After cuts | PersonaDayCard (after) |
| 6 | Trip purpose | TripPurposeProxy |
| 7 | Recovery vs cuts | **New: RidershipRecovery** |
| 8 | Regional map | EquityMap3 |

---

## Reordering note (vs. current build)

Build order today: Opening → personas before → FY26 → corridor map → pull quote → personas after → trip purpose → dot map. Narrative prefers: hook with scale + paradox → **personas before** → **FY26** → **corridor** → **personas after** → **trip purpose** → **recovery chapter** → **dot map**. Place the existing P10 pull quote between corridor and persona-after (or after persona-after) for pacing.

---

## New viz: Ridership Recovery

**Concept:** Grouped bars or slope: % recovery (recent vs 2017–19 baseline) by neighborhood poverty tier; optional overlay of FY26 status (eliminated / major / minor).

**Editorial line:** Tighter recovery in dependent corridors is evidence of need, not proof of waste. Annotate the **19-point** gap (high- vs low-poverty tier across all routes in file).

---

## Key numbers (quick reference)

| Fact | Source |
|------|--------|
| ~120,000 daily riders (PRT FY23 ASR language) | rideprt.org ASR PDF |
| ~118,512 recent weekday sum (routes in build) | `ridership.csv` / FY26_route_status_all |
| ~222,993 baseline weekday sum (routes) | FY26_route_status_all.csv |
| 41 eliminated, 57 reduced (28 major, 29 minor) | FY26_route_status_all.csv |
| LLB / SH profiles | fy26_route_n_profiles_all.csv |
| 71B / P10 ridership rows | FY26_route_status_all.csv |
| High vs low poverty recovery gap | Computed from FY26_route_status_all.csv |

---

## Notes

- Composite times and addresses: **illustrative** until verified against GTFS/maps.
- Recovery tiers use `pct_below_poverty_line_residents` on route rows — editorial groupings.
- P10’s route-level poverty in `FY26_route_status_all.csv` reflects anchor hoods (e.g. Brighton Heights); persona uses LLB at the physical stop — see `docs/PERSONAS.md`.
