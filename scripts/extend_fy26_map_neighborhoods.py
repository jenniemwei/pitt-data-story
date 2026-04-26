#!/usr/bin/env python3
"""Build fy26_route_n_profiles_all.csv from neighborhoods + stop-based service.

Route–neighborhood links: `build_neighborhood_route_service.py` — stop points vs
`neighborhoods.geojson` (plus optional buffer), not route line shapes. Details in
`data/neighborhood_route_service.json`.

- **All routes**: qualifying city stop in or near the polygon.
- **Street routes**: same, excluding ``BUSWAY`` platform stops.

FY26 cut flags: ``data/FY26_route_status_all.csv``. Demographics:
``data/primary/neighborhood_profiles.csv`` via ``data/n_crosswalk.csv``.

Rewrites the target CSV in full so new columns stay aligned for every row.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT / "scripts") not in sys.path:
    sys.path.insert(0, str(ROOT / "scripts"))
from build_neighborhood_route_service import get_fy26_hood_route_sets

DATA = ROOT / "data"
GEOJSON = DATA / "neighborhoods.geojson"
CROSSWALK = DATA / "n_crosswalk.csv"
PROFILES = DATA / "primary" / "neighborhood_profiles.csv"
STATUS = DATA / "FY26_route_status_all.csv"
TARGET = DATA / "fy26_route_n_profiles_all.csv"

# Crosswalk/ACS: GeoJSON `hood` may differ from `n_crosswalk` `hood` row label.
PROFILE_OVERRIDES: dict[str, tuple[str, str]] = {
    "Arlington": (
        "Arlington - Arlington Heights - Mount Oliver(City Neighborhood) - St. Clair",
        "neighborhood group",
    ),
    "Arlington Heights": (
        "Arlington - Arlington Heights - Mount Oliver(City Neighborhood) - St. Clair",
        "neighborhood group",
    ),
}

FIELDNAMES = [
    "neighborhood",
    "status_tags",
    "routes_before_count",
    "routes_before",
    "routes_losing_count",
    "routes_losing",
    "reduced_routes_count",
    "reduced_routes",
    "routes_after_count",
    "routes_after",
    "routes_before_street_count",
    "routes_before_street",
    "routes_losing_street_count",
    "routes_losing_street",
    "reduced_routes_street_count",
    "reduced_routes_street",
    "routes_after_street_count",
    "routes_after_street",
    "population_total",
    "below_poverty_count",
    "below_poverty_pct",
    "transit_dependent_count_proxy",
    "transit_dependent_pct_proxy",
]


def route_to_fy26(raw: str) -> str:
    s = (raw or "").strip().upper()
    if not s:
        return ""
    m = re.match(r"^(\d+)(.*)$", s)
    if m:
        return m.group(1).zfill(3) + m.group(2)
    return s


def semijoin(codes: set[str]) -> str:
    if not codes:
        return ""
    return ";".join(sorted(codes))


def build_hood_route_sets() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Return (all_routes_by_hood, street_only_routes_by_hood)."""
    return get_fy26_hood_route_sets()


def load_fy26_route_status() -> tuple[set[str], set[str]]:
    eliminated: set[str] = set()
    reduced: set[str] = set()
    with STATUS.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            code = (row.get("route_code") or "").strip()
            if not code:
                continue
            st = (row.get("route_status") or "").strip().lower()
            if st == "eliminated":
                eliminated.add(code)
            elif st == "reduced":
                reduced.add(code)
    return eliminated, reduced


def load_profile_index() -> dict[tuple[str, str], dict[str, str]]:
    """Key: (NeighborhoodGroup, GeographyType lowercased)."""
    out: dict[tuple[str, str], dict[str, str]] = {}
    with PROFILES.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            g = (row.get("NeighborhoodGroup") or "").strip()
            gt = (row.get("GeographyType") or "").strip().lower()
            if not g:
                continue
            out[(g, gt)] = row
    return out


def load_crosswalk() -> dict[str, dict[str, str]]:
    by_hood: dict[str, dict[str, str]] = {}
    with CROSSWALK.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            h = (row.get("hood") or "").strip()
            if h:
                by_hood[h] = row
    return by_hood


def profile_for_geo_hood(
    geo_hood: str,
    crosswalk_by_hood: dict[str, dict[str, str]],
    profile_by_key: dict[tuple[str, str], dict[str, str]],
) -> dict[str, str]:
    if geo_hood in PROFILE_OVERRIDES:
        g, gt = PROFILE_OVERRIDES[geo_hood]
        row = profile_by_key.get((g, gt.lower()))
        if not row:
            msg = f"No neighborhood_profiles row for override {geo_hood!r} -> {(g, gt)}"
            raise KeyError(msg)
        return row
    cw = crosswalk_by_hood.get(geo_hood)
    if not cw:
        msg = f"Missing n_crosswalk.csv row for hood {geo_hood!r}"
        raise KeyError(msg)
    g = (cw.get("NeighborhoodGroup") or "").strip()
    gt = (cw.get("GeographyType") or "").strip().lower()
    row = profile_by_key.get((g, gt))
    if not row:
        msg = f"No neighborhood_profiles row for {geo_hood!r} -> {(g, gt)}"
        raise KeyError(msg)
    return row


def compute_status_tags(
    losing: set[str], reduced_hit: set[str], after: set[str]
) -> str:
    tags: list[str] = []
    if losing:
        tags.append("eliminated")
    if reduced_hit:
        tags.append("reduced")
    if not after:
        tags.append("cut_off")
    return ";".join(tags)


def row_for_hood(
    geo_hood: str,
    hood_routes_all: dict[str, set[str]],
    hood_routes_street: dict[str, set[str]],
    eliminated: set[str],
    reduced: set[str],
    crosswalk_by_hood: dict[str, dict[str, str]],
    profile_by_key: dict[tuple[str, str], dict[str, str]],
) -> dict[str, str]:
    before = set(hood_routes_all.get(geo_hood, set()))
    before_st = set(hood_routes_street.get(geo_hood, set()))

    losing = before & eliminated
    reduced_hit = before & reduced
    after = before - eliminated

    losing_st = before_st & eliminated
    reduced_st = before_st & reduced
    after_st = before_st - eliminated

    prof = profile_for_geo_hood(geo_hood, crosswalk_by_hood, profile_by_key)
    pop = (prof.get("Var_2022_TotalPopulation") or "").strip()
    bpc = (prof.get("Var_2022_poverty_3") or "").strip()
    bpp = (prof.get("Var_2022_poverty_Per_3") or "").strip()
    tdc = (prof.get("Var_2022_commuting_3") or "").strip()
    tdp = (prof.get("Var_2022_commuting_Per_3") or "").strip()

    return {
        "neighborhood": geo_hood,
        "status_tags": compute_status_tags(losing, reduced_hit, after),
        "routes_before_count": str(len(before)),
        "routes_before": semijoin(before),
        "routes_losing_count": str(len(losing)),
        "routes_losing": semijoin(losing),
        "reduced_routes_count": str(len(reduced_hit)),
        "reduced_routes": semijoin(reduced_hit),
        "routes_after_count": str(len(after)),
        "routes_after": semijoin(after),
        "routes_before_street_count": str(len(before_st)),
        "routes_before_street": semijoin(before_st),
        "routes_losing_street_count": str(len(losing_st)),
        "routes_losing_street": semijoin(losing_st),
        "reduced_routes_street_count": str(len(reduced_st)),
        "reduced_routes_street": semijoin(reduced_st),
        "routes_after_street_count": str(len(after_st)),
        "routes_after_street": semijoin(after_st),
        "population_total": pop,
        "below_poverty_count": bpc,
        "below_poverty_pct": bpp,
        "transit_dependent_count_proxy": tdc,
        "transit_dependent_pct_proxy": tdp,
    }


def main() -> None:
    hood_routes_all, hood_routes_street = build_hood_route_sets()
    eliminated, reduced = load_fy26_route_status()
    profile_by_key = load_profile_index()
    crosswalk_by_hood = load_crosswalk()

    with GEOJSON.open(encoding="utf-8") as f:
        geo_hoods = {feat["properties"]["hood"].strip() for feat in json.load(f)["features"]}

    existing_names: set[str] = set()
    if TARGET.exists():
        with TARGET.open(newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                n = (r.get("neighborhood") or "").strip()
                if n:
                    existing_names.add(n)

    all_names = sorted(geo_hoods | existing_names, key=str.lower)
    rows: list[dict[str, str]] = []
    for geo_hood in all_names:
        rows.append(
            row_for_hood(
                geo_hood,
                hood_routes_all,
                hood_routes_street,
                eliminated,
                reduced,
                crosswalk_by_hood,
                profile_by_key,
            )
        )

    with TARGET.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES)
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows to {TARGET}.")


if __name__ == "__main__":
    main()
