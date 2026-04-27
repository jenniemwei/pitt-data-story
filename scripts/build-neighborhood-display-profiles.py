#!/usr/bin/env python3
"""Build ``data/display_profiles_2024.csv`` for map sidebar panels (reproducible path).

**Why this pipeline exists (vs only hand-editing a CSV in ``public/data``):**
- Ties every neighborhood polygon label to the same **crosswalk + overrides** as the route/FY26
  pipeline, so profile rows match ``neighborhoods.geojson`` and merge cleanly with
  ``n_profiles_new.csv`` in the app.
- When ACS or primary tables change, you **regenerate** one file instead of pasting error-prone
  partial updates.

**Alternative:** a script such as ``update_to_2024.py`` (or a checked-in
``public/data/display_profiles_2024.csv``) can be the source of truth; then this builder is
optional. If you use only the public file, run ``npm run sync-data`` will skip missing ``data/``
  copies; commit ``public/data`` so deploys still serve the file.

Input: ``data/primary/neighborhood_profiles.csv`` + ``n_crosswalk.csv`` + ``neighborhoods.geojson``.
Regenerate when those change, then run ``sync-public-data`` to publish into ``public/data``.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
GEOJSON = DATA / "neighborhoods.geojson"
CROSSWALK = DATA / "n_crosswalk.csv"
PROFILES = DATA / "primary" / "neighborhood_profiles.csv"
TARGET = DATA / "display_profiles_2024.csv"

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

# Var_2022_* -> semantic (subset used by CoverageMap + room for growth)
VAR_SEMANTIC = {
    "Var_2022_TotalPopulation": "total_pop",
    "Var_2022_poverty_Per_2": "share_below_50pct_poverty_threshold",
    "Var_2022_poverty_Per_3": "share_below_100pct_poverty_threshold",
    "Var_2022_commuting_Per_2": "share_commute_car_truck_van",
    "Var_2022_commuting_Per_3": "share_commute_public_transit",
    "Var_2022_commuting_Per_4": "share_commute_bicycle",
    "Var_2022_commuting_Per_5": "share_commute_walked",
    "Var_2022_commuting_Per_6": "share_commute_other_modes",
    "Var_2022_commuting_Per_7": "share_commute_worked_from_home",
    "Var_2022_income_Per_6": "share_hh_income_100k_to_199k",
    "Var_2022_income_Per_7": "share_hh_income_200k_plus",
}


def to_float(raw: str) -> float:
    s = (raw or "").strip()
    if not s or s.upper() in {"NA", "N/A", "NAN", "INF", "-INF"}:
        return 0.0
    try:
        return float(s)
    except ValueError:
        return 0.0


def load_profile_index() -> dict[tuple[str, str], dict[str, str]]:
    out: dict[tuple[str, str], dict[str, str]] = {}
    with PROFILES.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            g = (row.get("NeighborhoodGroup") or "").strip()
            gt = (row.get("GeographyType") or "").strip().lower()
            if g:
                out[(g, gt)] = row
    return out


def load_crosswalk() -> dict[str, dict[str, str]]:
    by_hood: dict[str, dict[str, str]] = {}
    with CROSSWALK.open(newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            h = (row.get("hood") or "").strip()
            if h:
                by_hood[h] = row
    return by_hood


def profile_for_geo_hood(
    geo_hood: str,
    crosswalk_by_hood: dict[str, dict[str, str]],
    profile_by_key: dict[tuple[str, str], dict[str, str]],
) -> tuple[dict[str, str], str]:
    if geo_hood in PROFILE_OVERRIDES:
        g, gt_label = PROFILE_OVERRIDES[geo_hood]
        gt = gt_label.strip().lower()
        row = profile_by_key.get((g, gt))
        if not row:
            raise KeyError(f"No primary profile for override {geo_hood!r} -> {(g, gt)}")
        return row, gt_label
    cw = crosswalk_by_hood.get(geo_hood)
    if not cw:
        raise KeyError(f"Missing n_crosswalk row for hood {geo_hood!r}")
    g = (cw.get("NeighborhoodGroup") or "").strip()
    gt = (cw.get("GeographyType") or "").strip().lower()
    gt_label = (cw.get("GeographyType") or "").strip()
    row = profile_by_key.get((g, gt))
    if not row:
        raise KeyError(f"No primary profile for {geo_hood!r} -> {(g, gt)}")
    return row, gt_label


def main() -> None:
    profile_by_key = load_profile_index()
    crosswalk_by_hood = load_crosswalk()

    with GEOJSON.open(encoding="utf-8") as f:
        hood_geo = json.load(f)
    hoods = sorted(
        {str(f["properties"].get("hood") or "").strip() for f in hood_geo["features"]}
        - {""}
    )

    fieldnames = ["neighborhood_group", "geography_type", "profile_neighborhood_group"] + list(
        VAR_SEMANTIC.values()
    )

    rows_out: list[dict[str, str]] = []
    for hood in hoods:
        prof, gt_label = profile_for_geo_hood(hood, crosswalk_by_hood, profile_by_key)
        src_g = (prof.get("NeighborhoodGroup") or "").strip()
        out: dict[str, str] = {
            "neighborhood_group": hood,
            "geography_type": gt_label,
            "profile_neighborhood_group": src_g,
        }
        for var, sem in VAR_SEMANTIC.items():
            out[sem] = str(to_float(prof.get(var)))
        rows_out.append(out)

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    with TARGET.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows_out)

    print(f"Wrote {len(rows_out)} rows to {TARGET.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
