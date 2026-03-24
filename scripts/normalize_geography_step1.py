#!/usr/bin/env python3
"""
Step 1 from docs/transit_cuts_equity_analysis_2802ad58.plan.md:
- Filter neighborhood_profiles to GeographyType = neighborhood (and export neighborhood group separately).
- Build hood ↔ NeighborhoodGroup crosswalk (explicit overrides in data/neighborhood_hood_crosswalk_overrides.csv).
- Emit route_stop_per_route.csv: one row per stop × route (drops route_sort=00 aggregate rows).
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"

NEIGHBORHOOD_PROFILES = DATA / "neighborhood_profiles.csv"
OUT_NEIGHBORHOOD = DATA / "neighborhood_profiles_neighborhood.csv"
OUT_NEIGHBORHOOD_GROUP = DATA / "neighborhood_profiles_neighborhood_group.csv"
ROUTE_STOP = DATA / "route-stop-table.csv"
OUT_ROUTE_PER_ROUTE = DATA / "route_stop_per_route.csv"
OUT_CROSSWALK = DATA / "neighborhood_hood_crosswalk.csv"
OVERRIDES = DATA / "neighborhood_hood_crosswalk_overrides.csv"

PITTSBURGH_CITY = "Pittsburgh city (Allegheny, PA)"


def load_overrides() -> dict[str, tuple[str, str]]:
    """hood -> (NeighborhoodGroup, GeographyType)."""
    out: dict[str, tuple[str, str]] = {}
    with OVERRIDES.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            h = (row.get("hood") or "").strip()
            if not h:
                continue
            out[h] = (row["NeighborhoodGroup"].strip(), row["GeographyType"].strip())
    return out


def filter_profiles() -> tuple[set[str], set[str]]:
    """Write neighborhood- and neighborhood-group-only CSVs; return name sets for validation."""
    ng50: set[str] = set()
    ng16: set[str] = set()
    with NEIGHBORHOOD_PROFILES.open(newline="", encoding="utf-8") as fin:
        reader = csv.DictReader(fin)
        fieldnames = reader.fieldnames
        assert fieldnames is not None
        rows_n = []
        rows_g = []
        for row in reader:
            gt = (row.get("GeographyType") or "").strip()
            name = (row.get("NeighborhoodGroup") or "").strip()
            if gt == "neighborhood":
                rows_n.append(row)
                ng50.add(name)
            elif gt == "neighborhood group":
                rows_g.append(row)
                ng16.add(name)

    with OUT_NEIGHBORHOOD.open("w", newline="", encoding="utf-8") as fout:
        w = csv.DictWriter(fout, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows_n)

    with OUT_NEIGHBORHOOD_GROUP.open("w", newline="", encoding="utf-8") as fout:
        w = csv.DictWriter(fout, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows_g)

    return ng50, ng16


def iter_route_geography_keys() -> list[tuple[str, str, str]]:
    """Unique (muni, hood, munihood_display) from route-stop table."""
    seen: set[tuple[str, str, str]] = set()
    ordered: list[tuple[str, str, str]] = []
    with ROUTE_STOP.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            m = (row.get("muni") or "").strip()
            h = (row.get("hood") or "").strip()
            mh = (row.get("munihood_display") or "").strip()
            key = (m, h, mh)
            if key not in seen:
                seen.add(key)
                ordered.append(key)
    return ordered


def build_crosswalk(ng50: set[str], overrides: dict[str, tuple[str, str]]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for muni, hood, munihood in iter_route_geography_keys():
        if muni != PITTSBURGH_CITY:
            rows.append(
                {
                    "muni": muni,
                    "hood": hood,
                    "munihood_display": munihood,
                    "NeighborhoodGroup": "",
                    "GeographyType": "none",
                    "match_method": "outside_city_profiles",
                }
            )
            continue

        if not hood:
            rows.append(
                {
                    "muni": muni,
                    "hood": hood,
                    "munihood_display": munihood,
                    "NeighborhoodGroup": "",
                    "GeographyType": "none",
                    "match_method": "no_hood_label",
                }
            )
            continue

        if hood in ng50:
            rows.append(
                {
                    "muni": muni,
                    "hood": hood,
                    "munihood_display": munihood,
                    "NeighborhoodGroup": hood,
                    "GeographyType": "neighborhood",
                    "match_method": "acs_neighborhood_name",
                }
            )
        elif hood in overrides:
            ng, gt = overrides[hood]
            rows.append(
                {
                    "muni": muni,
                    "hood": hood,
                    "munihood_display": munihood,
                    "NeighborhoodGroup": ng,
                    "GeographyType": gt,
                    "match_method": "override_csv",
                }
            )
        else:
            rows.append(
                {
                    "muni": muni,
                    "hood": hood,
                    "munihood_display": munihood,
                    "NeighborhoodGroup": "",
                    "GeographyType": "none",
                    "match_method": "unmapped",
                }
            )

    return rows


def write_route_per_route() -> int:
    with ROUTE_STOP.open(newline="", encoding="utf-8") as fin:
        reader = csv.DictReader(fin)
        fieldnames = list(reader.fieldnames or [])
        if "route_id" not in fieldnames:
            fieldnames.append("route_id")

        n = 0
        with OUT_ROUTE_PER_ROUTE.open("w", newline="", encoding="utf-8") as fout:
            writer = csv.DictWriter(fout, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for row in reader:
                if (row.get("route_sort") or "").strip() == "00":
                    continue
                rs = (row.get("route_sort") or "").strip()
                row["route_id"] = rs
                writer.writerow(row)
                n += 1
    return n


def main() -> None:
    overrides = load_overrides()
    ng50, ng16 = filter_profiles()

    cross = build_crosswalk(ng50, overrides)
    unmapped = [r for r in cross if r["match_method"] == "unmapped"]
    if unmapped:
        raise SystemExit(f"Unmapped Pittsburgh hoods: {unmapped}")

    with OUT_CROSSWALK.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=[
                "muni",
                "hood",
                "munihood_display",
                "NeighborhoodGroup",
                "GeographyType",
                "match_method",
            ],
        )
        w.writeheader()
        w.writerows(cross)

    n = write_route_per_route()

    print(f"Wrote {OUT_NEIGHBORHOOD} ({len(ng50)} rows)")
    print(f"Wrote {OUT_NEIGHBORHOOD_GROUP} ({len(ng16)} rows)")
    print(f"Wrote {OUT_CROSSWALK} ({len(cross)} rows)")
    print(f"Wrote {OUT_ROUTE_PER_ROUTE} ({n} rows)")


if __name__ == "__main__":
    main()
