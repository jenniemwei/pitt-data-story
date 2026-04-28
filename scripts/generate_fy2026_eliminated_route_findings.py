#!/usr/bin/env python3
"""
Generate FY2026 route-level finding CSVs from `data/prt_fy2026_route_cuts.csv`:

- `data/fy2026_eliminated_route_findings.csv` — primary action `eliminate`.
- `data/fy2026_unaffected_route_findings.csv` — `retained_equity` (equity-retained; not eliminated;
  same demographic columns as eliminated).
- `data/fy2026_reduced_route_findings.csv` — non-eliminated cuts with `reduction_tier` = `major`
  (`frequency_reduction_30pct_plus`) or `minor` (`end_service_11pm`, `shorten`).

ACS columns: residents of anchor geography (not rider-level). Source: `data/n_profiles_new.csv`
(2022 shares are stored as fractions 0–1). Race shares use `white_alone_share`, `black_alone_share`,
`asian_alone_share` per `n__data_dict.csv`. Commute: car/truck/van vs public transit from
`share_commute_car_truck_van` and `share_commute_public_transit`. Poverty share uses
`share_below_100pct_poverty_threshold` (below 100% FPL).

Adds integer estimate columns next to each resident/household/worker % (rounded).
"""

# -----------------------------------------------------------------------------
# Route neighborhood anchors: use data/neighborhood_route_service.json (produced
# by scripts/build_neighborhood_route_service.py) — stop-based, not shape-based.
# Legacy hand map ROUTE_NEIGHBORHOODS was removed; run the build script to refresh.
# -----------------------------------------------------------------------------

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from statistics import mean
from typing import Any

from build_prt_fy2026_route_cuts import build_route_cut_rows, write_route_cut_rows

REPO = Path(__file__).resolve().parents[1]
NRS_JSON = REPO / "data" / "neighborhood_route_service.json"
MONTHLY_RIDERSHIP_CSV = (
    REPO / "data" / "monthly_avg_ridership.csv"
    if (REPO / "data" / "monthly_avg_ridership.csv").is_file()
    else REPO / "data" / "primary" / "monthly_avg_ridership.csv"
)


def normalize_route_key(key: str) -> str:
    key = (key or "").strip()
    if not key:
        return key
    m = re.match(r"^0*(\d+)([A-Za-z]*)$", key)
    if m:
        return f"{int(m.group(1)):03d}{m.group(2)}"
    return key


def canon_from_monthly_row(row: dict[str, str]) -> str:
    code = (row.get("ridership_route_code") or "").strip()
    if code:
        return normalize_route_key(code)
    r = (row.get("route") or "").strip()
    if r.isdigit():
        return f"{int(r):03d}"
    m = re.match(r"^(\d+)([A-Za-z]*)$", r)
    if m:
        return f"{int(m.group(1)):03d}{m.group(2)}"
    return r


def ffloat(x: str | None) -> float | None:
    if x in ("", "NA", None):
        return None
    try:
        return float(x)
    except ValueError:
        return None


PROFILES_PATH = "data/n_profiles_new.csv"

ANCHOR_RATIONALE = (
    "Anchor list from `data/neighborhood_route_service.json` (stop/polygon + buffer; "
    "not from route line geometry). Rebuild: `python3 scripts/build_neighborhood_route_service.py`."
)


def load_profiles() -> dict[str, dict[str, str]]:
    by_name: dict[str, dict[str, str]] = {}
    with open(PROFILES_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("geography_type") or "").strip() == "neighborhood":
                by_name[row["neighborhood_group"]] = row
    return by_name


def build_route_neighborhoods_from_stops() -> dict[str, tuple[list[str], str]]:
    """
    Invert `neighborhood_route_service.json` to route_id -> (ordered neighborhood names, note).

    Neighborhoods with any given route are ordered by strength (weekday `daily_trips`, then
    how many distinct stops, then name).
    """
    if not NRS_JSON.is_file():
        return {}
    with NRS_JSON.open(encoding="utf-8") as f:
        payload = json.load(f)
    by_route: dict[str, list[tuple[str, int, int]]] = {}
    for block in payload.get("neighborhoods", []):
        n = (block.get("neighborhood") or "").strip()
        for r in block.get("routes") or []:
            rid = (r.get("route_id") or "").strip()
            if not rid or not n:
                continue
            try:
                trips = int(r.get("daily_trips") or 0)
            except (TypeError, ValueError):
                trips = 0
            n_stops = len(r.get("stops_in_neighborhood") or [])
            by_route.setdefault(rid, []).append((n, trips, n_stops))
    out: dict[str, tuple[list[str], str]] = {}
    for route_key, pairs in by_route.items():
        pairs.sort(key=lambda x: (-x[1], -x[2], x[0].lower()))
        names = [t[0] for t in pairs]
        out[route_key] = (names, ANCHOR_RATIONALE)
    return out


def agg_neighborhoods(names: list[str], profiles: dict[str, dict[str, str]]) -> dict[str, Any]:
    rows = [profiles[n] for n in names if n in profiles]
    if not rows:
        return {}

    def avg(key: str) -> float | None:
        vals = [ffloat(r[key]) for r in rows]
        vals = [v for v in vals if v is not None]
        return mean(vals) if vals else None

    hi: list[float] = []
    for r in rows:
        p6, p7 = ffloat(r["share_hh_income_100k_to_199k"]), ffloat(r["share_hh_income_200k_plus"])
        if p6 is not None and p7 is not None:
            hi.append(p6 + p7)

    out = {
        "pop_2022": sum(int(float(r["total_pop"])) for r in rows),
        "households_total": sum(int(float(r["income_households_total"])) for r in rows),
        "workers_16_plus": sum(int(float(r["workers_16_plus"])) for r in rows),
        "poverty_determined_pop": sum(int(float(r["poverty_status_determined_pop"])) for r in rows),
        "white_pct": avg("white_alone_share"),
        "black_pct": avg("black_alone_share"),
        "asian_pct": avg("asian_alone_share"),
        "hispanic_pct": avg("hispanic_share"),
        "transit_commute_pct": avg("share_commute_public_transit"),
        "auto_commute_pct": avg("share_commute_car_truck_van"),
        "high_income_pct": mean(hi) if hi else None,
        "poverty_pct": avg("share_below_100pct_poverty_threshold"),
    }
    return out


def county_stats(row: dict[str, str]) -> dict[str, Any]:
    p6, p7 = ffloat(row["share_hh_income_100k_to_199k"]), ffloat(row["share_hh_income_200k_plus"])
    return {
        "pop_2022": int(float(row["total_pop"])),
        "households_total": int(float(row["income_households_total"])),
        "workers_16_plus": int(float(row["workers_16_plus"])),
        "poverty_determined_pop": int(float(row["poverty_status_determined_pop"])),
        "white_pct": ffloat(row["white_alone_share"]),
        "black_pct": ffloat(row["black_alone_share"]),
        "asian_pct": ffloat(row["asian_alone_share"]),
        "hispanic_pct": ffloat(row["hispanic_share"]),
        "transit_commute_pct": ffloat(row["share_commute_public_transit"]),
        "auto_commute_pct": ffloat(row["share_commute_car_truck_van"]),
        "high_income_pct": p6 + p7 if p6 and p7 else None,
        "poverty_pct": ffloat(row["share_below_100pct_poverty_threshold"]),
    }


def ridership_stats(code: str) -> tuple[float | None, float | None, float | None, float | None, float | None]:
    code = normalize_route_key(code)
    pre: list[float] = []
    post: list[float] = []
    covid: list[float] = []
    with MONTHLY_RIDERSHIP_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["day_type"] != "WEEKDAY" or canon_from_monthly_row(row) != code:
                continue
            v = ffloat(row["avg_riders"])
            if v is None:
                continue
            y = row["year_month"][:4]
            if y in ("2017", "2018", "2019"):
                pre.append(v)
            if y in ("2020", "2021"):
                covid.append(v)
            if y in ("2023", "2024"):
                post.append(v)
    pr = mean(pre) if pre else None
    po = mean(post) if post else None
    cv = mean(covid) if covid else None
    ch = ((po - pr) / pr * 100) if (pr and po) else None
    d2020 = ((cv - pr) / pr * 100) if (pr and cv) else None
    return pr, cv, po, ch, d2020


def route_full_name(code: str) -> str:
    code = normalize_route_key(code)
    best: tuple[str, str] | None = None
    with MONTHLY_RIDERSHIP_CSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if normalize_route_key(row.get("ridership_route_code") or "") != code and canon_from_monthly_row(row) != code:
                continue
            name = (row.get("route_full_name") or "").strip()
            ym = row.get("year_month") or ""
            if name and (best is None or ym > best[0]):
                best = (ym, name)
    return best[1] if best else ""


def pct_number(x: float | None) -> float | None:
    """Convert stored fraction to percent on 0–100 scale for CSV."""
    if x is None:
        return None
    return round(float(x) * 100, 1)


def est_count(universe: int | None, pct_0_100: float | None) -> int | None:
    """Round(universe * pct/100) for estimates shown alongside ACS shares."""
    if universe is None or pct_0_100 is None:
        return None
    return int(round(float(universe) * float(pct_0_100) / 100.0))


def build_route_finding_row(
    c: dict[str, str],
    profiles: dict[str, dict[str, str]],
    county: dict[str, str],
    route_neighborhoods_lookup: dict[str, tuple[list[str], str]] | None = None,
) -> dict[str, Any]:
    """One row aligned with `fy2026_eliminated_route_findings.csv` (no reduction_tier)."""
    rcode = c["ridership_route_code"]
    route = c["route"]
    nk = normalize_route_key(rcode)
    ninfo: tuple[list[str] | None, str] | None = None
    if route_neighborhoods_lookup:
        ninfo = route_neighborhoods_lookup.get(rcode) or route_neighborhoods_lookup.get(nk)
    if not ninfo:
        ninfo = (None, "No stop-based neighborhood mapping in neighborhood_route_service.json; county proxy.")
    names, rationale = ninfo
    demo = agg_neighborhoods(names, profiles) if names else county_stats(county)
    pr, cv, po, ch, d2020 = ridership_stats(rcode)
    rname = route_full_name(rcode)
    geo = (
        "City of Pittsburgh neighborhood(s), 2022 ACS"
        if names
        else "Allegheny County (region row), suburban / out-of-city proxy"
    )
    find_id = f"FIND-20260324-{nk.replace('/', '-')}"
    nhood_str = ", ".join(names) if names else "None (see geography note)"

    pop_total = demo.get("pop_2022")
    hh_total = demo.get("households_total")
    wk_total = demo.get("workers_16_plus")
    pov_univ = demo.get("poverty_determined_pop")

    pct_w = pct_number(demo.get("white_pct"))
    pct_b = pct_number(demo.get("black_pct"))
    pct_a = pct_number(demo.get("asian_pct"))
    pct_h = pct_number(demo.get("hispanic_pct"))
    pct_hi = pct_number(demo.get("high_income_pct"))
    pct_pov = pct_number(demo.get("poverty_pct"))
    pct_auto = pct_number(demo.get("auto_commute_pct"))
    pct_pt = pct_number(demo.get("transit_commute_pct"))

    return {
        "finding_id": find_id,
        "route_code": rcode,
        "route_label": route,
        "route_kind": c.get("route_kind", ""),
        "primary_reduction_detail": c.get("primary_reduction_detail", ""),
        "schedule_name": rname or "",
        "anchor_neighborhoods": nhood_str,
        "geography_layer": geo,
        "anchor_rationale": rationale,
        "acs_year": 2022,
        "population_2022_residents": pop_total,
        "affected_total_pop_2022": pop_total,
        "pct_white_alone_residents": pct_w,
        "pop_white_alone_residents_est": est_count(pop_total, pct_w),
        "pct_black_alone_residents": pct_b,
        "pop_black_alone_residents_est": est_count(pop_total, pct_b),
        "pct_asian_alone_residents": pct_a,
        "pop_asian_alone_residents_est": est_count(pop_total, pct_a),
        "pct_hispanic_residents": pct_h,
        "pop_hispanic_residents_est": est_count(pop_total, pct_h),
        "pct_households_top2_income_brackets": pct_hi,
        "households_top2_income_brackets_est": est_count(hh_total, pct_hi),
        "pct_below_poverty_line_residents": pct_pov,
        "pop_below_poverty_line_residents_est": est_count(pov_univ, pct_pov),
        "pct_journey_to_work_auto_drove_carpool": pct_auto,
        "workers_commute_car_truck_van_est": est_count(wk_total, pct_auto),
        "pct_journey_to_work_public_transit": pct_pt,
        "workers_commute_public_transit_est": est_count(wk_total, pct_pt),
        "weekday_avg_riders_baseline_2017_2019": round(pr, 1) if pr is not None else None,
        "weekday_avg_riders_covid_2020_2021": round(cv, 1) if cv is not None else None,
        "weekday_avg_riders_recent_2023_2024": round(po, 1) if po is not None else None,
        "pct_change_weekday_riders_covid_vs_baseline": round(d2020, 1) if d2020 is not None else None,
        "pct_change_weekday_riders_recent_vs_baseline": round(ch, 1) if ch is not None else None,
    }


def reduction_tier_for_action(action: str) -> str | None:
    """
    Map PRT primary_reduction_action to story tiers (non-eliminated routes only).

    - retained_equity: unchanged / equity-retained (no elimination; not a frequency cut).
    - frequency_reduction_30pct_plus: major.
    - end_service_11pm, shorten: minor (night end or length trim).
    """
    if action == "retained_equity":
        return "unaffected"
    if action == "frequency_reduction_30pct_plus":
        return "major"
    if action in ("end_service_11pm", "shorten"):
        return "minor"
    if action == "eliminate":
        return None
    raise ValueError(f"Unknown primary_reduction_action: {action!r}")


def write_csv(path: str, rows: list[dict[str, Any]], fieldnames: list[str]) -> None:
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main(*, persist_route_cuts_csv: bool = True) -> None:
    profiles = load_profiles()
    route_neighborhoods_lookup = build_route_neighborhoods_from_stops()
    county = None
    with open(PROFILES_PATH, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("neighborhood_group") == "Allegheny County" and (row.get("geography_type") or "").strip() == "region":
                county = row
                break
    assert county is not None

    # Build route-cut rows in-memory to avoid mandatory intermediate read/write coupling.
    all_cuts: list[dict[str, str]] = build_route_cut_rows()
    if persist_route_cuts_csv:
        write_route_cut_rows(all_cuts, REPO / "data" / "prt_fy2026_route_cuts.csv")

    eliminated = [r for r in all_cuts if r["primary_reduction_action"] == "eliminate"]
    non_elim = [r for r in all_cuts if r["primary_reduction_action"] != "eliminate"]

    csv_rows_elim: list[dict[str, Any]] = []
    for c in sorted(eliminated, key=lambda x: x["ridership_route_code"]):
        csv_rows_elim.append(
            build_route_finding_row(
                c,
                profiles,
                county,
                route_neighborhoods_lookup=route_neighborhoods_lookup,
            )
        )

    csv_path_elim = "data/fy2026_eliminated_route_findings.csv"
    if csv_rows_elim:
        write_csv(csv_path_elim, csv_rows_elim, list(csv_rows_elim[0].keys()))
        print(f"Wrote {len(csv_rows_elim)} rows to {csv_path_elim}")
    else:
        print("No eliminated routes found; skipping eliminated CSV write.")

    unaffected: list[dict[str, str]] = []
    reduced: list[dict[str, str]] = []
    for r in non_elim:
        tier = reduction_tier_for_action(r["primary_reduction_action"])
        if tier == "unaffected":
            unaffected.append(r)
        elif tier in ("major", "minor"):
            reduced.append(r)

    csv_rows_unaffected = [
        build_route_finding_row(
            c,
            profiles,
            county,
            route_neighborhoods_lookup=route_neighborhoods_lookup,
        )
        for c in sorted(unaffected, key=lambda x: x["ridership_route_code"])
    ]
    path_unaffected = "data/fy2026_unaffected_route_findings.csv"
    if csv_rows_unaffected:
        write_csv(path_unaffected, csv_rows_unaffected, list(csv_rows_unaffected[0].keys()))
        print(f"Wrote {len(csv_rows_unaffected)} rows to {path_unaffected}")
    else:
        print("No unaffected routes; skipping unaffected CSV write.")

    reduced_field_order = [
        "finding_id",
        "route_code",
        "route_label",
        "route_kind",
        "reduction_tier",
        "primary_reduction_detail",
        "schedule_name",
        "anchor_neighborhoods",
        "geography_layer",
        "anchor_rationale",
        "acs_year",
        "population_2022_residents",
        "affected_total_pop_2022",
        "pct_white_alone_residents",
        "pop_white_alone_residents_est",
        "pct_black_alone_residents",
        "pop_black_alone_residents_est",
        "pct_asian_alone_residents",
        "pop_asian_alone_residents_est",
        "pct_hispanic_residents",
        "pop_hispanic_residents_est",
        "pct_households_top2_income_brackets",
        "households_top2_income_brackets_est",
        "pct_below_poverty_line_residents",
        "pop_below_poverty_line_residents_est",
        "pct_journey_to_work_auto_drove_carpool",
        "workers_commute_car_truck_van_est",
        "pct_journey_to_work_public_transit",
        "workers_commute_public_transit_est",
        "weekday_avg_riders_baseline_2017_2019",
        "weekday_avg_riders_covid_2020_2021",
        "weekday_avg_riders_recent_2023_2024",
        "pct_change_weekday_riders_covid_vs_baseline",
        "pct_change_weekday_riders_recent_vs_baseline",
    ]
    csv_rows_reduced: list[dict[str, Any]] = []
    for c in sorted(reduced, key=lambda x: x["ridership_route_code"]):
        base = build_route_finding_row(
            c,
            profiles,
            county,
            route_neighborhoods_lookup=route_neighborhoods_lookup,
        )
        tier = reduction_tier_for_action(c["primary_reduction_action"])
        assert tier in ("major", "minor")
        row = {k: base[k] for k in base}
        # Insert reduction_tier after route_kind
        ordered: dict[str, Any] = {}
        for k in reduced_field_order:
            if k == "reduction_tier":
                ordered[k] = tier
            elif k in row:
                ordered[k] = row[k]
        csv_rows_reduced.append(ordered)

    path_reduced = "data/fy2026_reduced_route_findings.csv"
    if csv_rows_reduced:
        write_csv(path_reduced, csv_rows_reduced, reduced_field_order)
        print(f"Wrote {len(csv_rows_reduced)} rows to {path_reduced}")
    else:
        print("No reduced routes; skipping reduced CSV write.")


if __name__ == "__main__":
    main()
