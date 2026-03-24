# Dataset limitations — Pitt data story

Single reference for **strengths, concerns, and how we still use** each major source. Interpret findings in [FINDINGS_LOG.md](FINDINGS_LOG.md) alongside this file.

## 1. Route and stop data

| | |
|--|--|
| **Role** | Physical stop locations; which bus routes serve each stop; network geometry for maps and spatial joins. |
| **Pros** | Pinpoints where service is offered; links routes to stops for downstream joins; updated regularly (confirm vintage in your extract, e.g. GTFS feed date). |
| **Cons / concerns** | Contains **no ridership** or other quantitative usage; geometry alone does not show demand or dependence. |

**How we still use it:** Foundation for mapping routes and stops; join to GTFS `routes`/`stop_times` to attach routes to stops; combine with ridership or usage tables at stop or route level using shared IDs.

---

## 2. Average monthly ridership by route

| | |
|--|--|
| **Role** | Time-series and day-type ridership **by route** (not by stop). In-repo: [`data/monthly_avg_ridership.csv`](../data/monthly_avg_ridership.csv). |
| **Pros** | Monthly aggregation; **weekday vs weekend** (`day_type`); includes recent years (e.g. through **2024** in available extracts), useful for current relevance. |
| **Cons / concerns** | **No stop-, trip-, or segment-level** detail; long routes through diverse neighborhoods are **hard to assign** to a single place; may need **cross-checking** with pre-pandemic stop-level data for context; **no rider demographics**. |

**How we still use it:** Weight **route-level exposure** to cuts (e.g. from [`data/prt_fy2026_route_cuts.csv`](../data/prt_fy2026_route_cuts.csv)) by recent `avg_riders` or trends; join on `ridership_route_code` (and `route` where needed); document month/year and `day_type` filters in each finding.

---

## 3. Average stop usage

| | |
|--|--|
| **Role** | **Stop-level** boarding and alighting (or similar) for spatial analysis. |
| **Pros** | **High resolution** at the stop; supports geography-heavy “where is usage concentrated?” questions. |
| **Cons / concerns** | **Temporal:** often only through **2021** (pandemic-era), so patterns may **not match 2024–2026** behavior; **no rider demographics**. |

**How we still use it:** Treat as a **spatial prior** or historical baseline; pair with **2024 route ridership** or current GTFS for recency checks; label charts clearly with data year; avoid presenting stop counts as “current” without a caveat.

---

## 4. Neighborhood demographics (2022)

| | |
|--|--|
| **Role** | Socioeconomic context by neighborhood: e.g. **income**, **car-free households**, **transit reliance** (exact fields depend on source table). |
| **Pros** | **2022** snapshot — **somewhat post-COVID**; indicators align with **equity and dependence** framing. |
| **Cons / concerns** | **Margins of error** can be **wide** for small-population neighborhoods; geography often **ends at city limits**, so **excluding** many suburbs and PRT riders outside the city boundary unless you add another geography. |

**How we still use it:** Attach to stops or routes via **tract/neighborhood crosswalk**; prefer **ranges or percentiles** where MOE is large; state geography (city vs county) in every finding that uses these fields.

---

## Cross-dataset reminders

- **Join keys:** Document `ridership_route_code` (and `route`) when linking cuts and monthly ridership; stop IDs when linking route/stop data to stop usage; GEOIDs for demographics.
- **Stale vs fresh:** Stop usage (2021) vs route ridership (2024) vs demographics (2022) vs proposed cuts (FY2026 narrative) — **do not merge without stating year alignment** in [FINDINGS_LOG.md](FINDINGS_LOG.md).
