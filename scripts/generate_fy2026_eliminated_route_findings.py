#!/usr/bin/env python3
"""
Generate FY2026 route-level finding CSVs from `data/prt_fy2026_route_cuts.csv`:

- `data/fy2026_eliminated_route_findings.csv` — primary action `eliminate`.
- `data/fy2026_unaffected_route_findings.csv` — `retained_equity` (equity-retained; not eliminated;
  same demographic columns as eliminated).
- `data/fy2026_reduced_route_findings.csv` — non-eliminated cuts with `reduction_tier` = `major`
  (`frequency_reduction_30pct_plus`) or `minor` (`end_service_11pm`, `shorten`).

ACS columns: residents of anchor geography (not rider-level). Race fields verified against US +
Homewood South rows; differs from header order in data_dict:
  Var_2022_Race_Per_1 = White alone %, Var_2022_Race_Per_2 = Black alone %
"""

from __future__ import annotations

import csv
import re
from statistics import mean
from typing import Any

ROUTE_NEIGHBORHOODS: dict[str, tuple[list[str] | None, str]] = {
    "002": (["Mount Washington"], "Corridor anchor for Mount Royal / South Hills access."),
    "004": (["Perry South"], "Troy Hill and Northside river communities."),
    "007": (["Fineview"], "Spring Garden and Fineview area."),
    "014": (["Brighton Heights"], "Ohio River North / Brighton Heights corridor."),
    "018": (["Central Northside"], "Manchester and Northside."),
    "020": (["Crafton Heights"], "Kennedy / western corridor."),
    "026": (["Crafton Heights"], "Chartiers Valley / West End."),
    "029": (None, "Robinson and western suburbs (outside city neighborhood layer)."),
    "036": (["Banksville"], "Banksville and South Hills."),
    "038": (None, "Green Tree borough (outside city neighborhood layer)."),
    "039": (["Brookline"], "Brookline."),
    "040": (["Mount Washington"], "Mount Washington."),
    "041": (["Beechview"], "Bower Hill / Beechview / South Hills."),
    "043": (["Knoxville"], "Bailey / South Hills corridor."),
    "058": (["Greenfield"], "Greenfield."),
    "065": (["Squirrel Hill South"], "Squirrel Hill."),
    "071": (None, "Edgewood / eastern suburbs (outside city neighborhood layer)."),
    "G3": (None, "Moon and western express (outside city neighborhood layer)."),
    "O1": (["Marshall-Shadeland"], "Ross / McKnight Road corridor city end."),
    "O5": (None, "Thompson Run / northern suburbs."),
    "P7": (None, "McKeesport / Mon Valley (outside city neighborhood layer)."),
    "Y1": (None, "Large Flyer — regional express."),
    "G31": (["Brookline"], "Bridgeville Flyer — Brookline / South Hills."),
    "O12": (["Brighton Heights"], "McKnight Flyer — northern corridor."),
    "P10": (["Brighton Heights"], "Allegheny Valley Flyer — northern corridor."),
    "P12": (None, "Holiday Park / eastern suburbs."),
    "P13": (["Mount Washington"], "Mount Royal Flyer."),
    "P16": (["East Hills"], "Penn Hills Flyer — East Hills city pocket."),
    "P17": (["Lincoln Place"], "Lincoln Park Flyer."),
    "P67": (None, "Monroeville express."),
    "P69": (None, "Trafford / eastern corridor."),
    "P71": (["Swisshelm Park"], "Swissvale Flyer — Swisshelm Park area."),
    "P76": (None, "Lincoln Highway express."),
    "Y45": (["Carrick"], "Baldwin Manor Flyer — Carrick / South."),
    "Y47": (["Brookline"], "Curry Flyer — South Hills."),
    "Y49": (["Carrick"], "Prospect Flyer — Carrick / South."),
    "019L": (["Brighton Heights"], "Emsworth Limited — Ohio River north."),
    "051L": (["Carrick"], "Carrick Limited."),
    "052L": (["Homewood South"], "Homewood / Homestead-limited corridor."),
    "053L": (["Swisshelm Park"], "Homestead Park Limited — Mon Valley / East."),
    "SLVR": (["Overbrook"], "Silver Line — South Hills rail; Overbrook area."),
}


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


def load_profiles() -> dict[str, dict[str, str]]:
    by_name: dict[str, dict[str, str]] = {}
    with open("data/neighborhood_profiles.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("GeographyType") == "neighborhood":
                by_name[row["NeighborhoodGroup"]] = row
    return by_name


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
        p6, p7 = ffloat(r["Var_2022_income_Per_6"]), ffloat(r["Var_2022_income_Per_7"])
        if p6 is not None and p7 is not None:
            hi.append(p6 + p7)

    out = {
        "pop_2022": sum(int(float(r["Var_2022_TotalPopulation"])) for r in rows),
        "white_pct": avg("Var_2022_Race_Per_1"),
        "black_pct": avg("Var_2022_Race_Per_2"),
        "asian_pct": avg("Var_2022_Race_Per_3"),
        "hispanic_pct": avg("Var_2022_Hispanic_Per"),
        "transit_commute_pct": avg("Var_2022_commuting_Per_5"),
        "auto_commute_pct": None,
        "high_income_pct": mean(hi) if hi else None,
        "poverty_pct": avg("Var_2022_poverty_Per_2"),
    }
    da, cp = avg("Var_2022_commuting_Per_2"), avg("Var_2022_commuting_Per_3")
    if da is not None and cp is not None:
        out["auto_commute_pct"] = da + cp
    return out


def county_stats(row: dict[str, str]) -> dict[str, Any]:
    p6, p7 = ffloat(row["Var_2022_income_Per_6"]), ffloat(row["Var_2022_income_Per_7"])
    da, cp = ffloat(row["Var_2022_commuting_Per_2"]), ffloat(row["Var_2022_commuting_Per_3"])
    return {
        "pop_2022": int(float(row["Var_2022_TotalPopulation"])),
        "white_pct": ffloat(row["Var_2022_Race_Per_1"]),
        "black_pct": ffloat(row["Var_2022_Race_Per_2"]),
        "asian_pct": ffloat(row["Var_2022_Race_Per_3"]),
        "hispanic_pct": ffloat(row["Var_2022_Hispanic_Per"]),
        "transit_commute_pct": ffloat(row["Var_2022_commuting_Per_5"]),
        "auto_commute_pct": da + cp if da and cp else None,
        "high_income_pct": p6 + p7 if p6 and p7 else None,
        "poverty_pct": ffloat(row["Var_2022_poverty_Per_2"]),
    }


def ridership_stats(code: str) -> tuple[float | None, float | None, float | None, float | None, float | None]:
    code = normalize_route_key(code)
    pre: list[float] = []
    post: list[float] = []
    covid: list[float] = []
    with open("data/monthly_avg_ridership.csv", encoding="utf-8") as f:
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
    with open("data/monthly_avg_ridership.csv", encoding="utf-8") as f:
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


def build_route_finding_row(c: dict[str, str], profiles: dict[str, dict[str, str]], county: dict[str, str]) -> dict[str, Any]:
    """One row aligned with `fy2026_eliminated_route_findings.csv` (no reduction_tier)."""
    rcode = c["ridership_route_code"]
    route = c["route"]
    nk = normalize_route_key(rcode)
    ninfo = ROUTE_NEIGHBORHOODS.get(rcode) or ROUTE_NEIGHBORHOODS.get(nk)
    if not ninfo:
        ninfo = (None, "Mapping note: default rationale.")
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
        "population_2022_residents": demo.get("pop_2022"),
        "pct_white_alone_residents": pct_number(demo.get("white_pct")),
        "pct_black_alone_residents": pct_number(demo.get("black_pct")),
        "pct_asian_alone_residents": pct_number(demo.get("asian_pct")),
        "pct_hispanic_residents": pct_number(demo.get("hispanic_pct")),
        "pct_households_top2_income_brackets": pct_number(demo.get("high_income_pct")),
        "pct_below_poverty_line_residents": pct_number(demo.get("poverty_pct")),
        "pct_journey_to_work_auto_drove_carpool": pct_number(demo.get("auto_commute_pct")),
        "pct_journey_to_work_public_transit": pct_number(demo.get("transit_commute_pct")),
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


def main() -> None:
    profiles = load_profiles()
    county = None
    with open("data/neighborhood_profiles.csv", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row.get("NeighborhoodGroup") == "Allegheny County" and row.get("GeographyType") == "region":
                county = row
                break
    assert county is not None

    all_cuts: list[dict[str, str]] = []
    with open("data/prt_fy2026_route_cuts.csv", encoding="utf-8") as f:
        all_cuts = list(csv.DictReader(f))

    eliminated = [r for r in all_cuts if r["primary_reduction_action"] == "eliminate"]
    non_elim = [r for r in all_cuts if r["primary_reduction_action"] != "eliminate"]

    csv_rows_elim: list[dict[str, Any]] = []
    for c in sorted(eliminated, key=lambda x: x["ridership_route_code"]):
        csv_rows_elim.append(build_route_finding_row(c, profiles, county))

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

    csv_rows_unaffected = [build_route_finding_row(c, profiles, county) for c in sorted(unaffected, key=lambda x: x["ridership_route_code"])]
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
        "pct_white_alone_residents",
        "pct_black_alone_residents",
        "pct_asian_alone_residents",
        "pct_hispanic_residents",
        "pct_households_top2_income_brackets",
        "pct_below_poverty_line_residents",
        "pct_journey_to_work_auto_drove_carpool",
        "pct_journey_to_work_public_transit",
        "weekday_avg_riders_baseline_2017_2019",
        "weekday_avg_riders_covid_2020_2021",
        "weekday_avg_riders_recent_2023_2024",
        "pct_change_weekday_riders_covid_vs_baseline",
        "pct_change_weekday_riders_recent_vs_baseline",
    ]
    csv_rows_reduced: list[dict[str, Any]] = []
    for c in sorted(reduced, key=lambda x: x["ridership_route_code"]):
        base = build_route_finding_row(c, profiles, county)
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
