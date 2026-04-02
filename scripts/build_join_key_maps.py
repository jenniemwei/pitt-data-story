#!/usr/bin/env python3
"""Generate join-key QA artifacts for equity map data."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
OUT_DIR = DATA_DIR / "join"

ROUTE_ALIAS_MAP = {
    # L-suffixed legacy commuter variants
    "019L": "19L",
    "051L": "51L",
    "052L": "52L",
    "053L": "53L",
    # Busway and 71-series route-code formatting variants
    "028X": "28X",
    "061A": "61A",
    "061B": "61B",
    "061C": "61C",
    "061D": "61D",
    "071A": "71A",
    "071B": "71B",
    "071C": "71C",
    "071D": "71D",
    # Light-rail branch code aliases in route-lines geometry
    "BLLB": "BLUE",
    "BLSV": "BLUE",
    # Incline code appears as MI in geometry
    "000": "MI",
    "0": "MI",
}


def normalize_text(value: str) -> str:
    value = (value or "").strip().lower()
    value = value.replace("&", "and")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_route_id(value: str) -> str:
    raw = (value or "").strip().upper()
    if not raw:
        return ""
    if raw.isdigit():
        return str(int(raw))
    return raw


def canonical_route_id(value: str) -> str:
    norm = normalize_route_id(value)
    return ROUTE_ALIAS_MAP.get(norm, norm)


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_csv(path: Path, rows: list[dict[str, str]], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def build_route_key_map() -> dict[str, int]:
    status_rows = load_csv(DATA_DIR / "FY26_route_status_all.csv")

    with (DATA_DIR / "route_lines_current.geojson").open(encoding="utf-8") as f:
        route_geo = json.load(f)

    geo_keys = set()
    for feat in route_geo.get("features", []):
        props = feat.get("properties") or {}
        raw = props.get("route_code") or props.get("route_id") or ""
        geo_keys.add(normalize_route_id(raw))

    out_rows: list[dict[str, str]] = []
    unmatched_rows: list[dict[str, str]] = []
    unmatched = 0
    matched = 0

    for row in status_rows:
        source = (row.get("route_code") or "").strip().upper()
        canonical = canonical_route_id(source)
        route_label = (row.get("route_label") or "").strip().upper()
        route_name = (row.get("schedule_name") or "").strip()

        in_geo = canonical in geo_keys
        match_rule = "exact_or_normalized_match" if in_geo else "missing_in_route_geojson"
        if in_geo:
            matched += 1
        else:
            unmatched += 1

        out_rows.append(
            {
                "finding_id": row.get("finding_id", ""),
                "route_status": row.get("route_status", ""),
                "source_route_code": source,
                "canonical_route_id": canonical,
                "source_route_label": route_label,
                "route_name": route_name,
                "in_route_lines_geojson": "yes" if in_geo else "no",
                "match_rule": match_rule,
                "note_069_vs_p69": "kept distinct keys",
            }
        )
        if not in_geo:
            unmatched_rows.append(out_rows[-1])

    write_csv(
        OUT_DIR / "route_key_map.csv",
        out_rows,
        [
            "finding_id",
            "route_status",
            "source_route_code",
            "canonical_route_id",
            "source_route_label",
            "route_name",
            "in_route_lines_geojson",
            "match_rule",
            "note_069_vs_p69",
        ],
    )
    write_csv(
        OUT_DIR / "route_key_map_unmatched.csv",
        unmatched_rows,
        [
            "finding_id",
            "route_status",
            "source_route_code",
            "canonical_route_id",
            "source_route_label",
            "route_name",
            "in_route_lines_geojson",
            "match_rule",
            "note_069_vs_p69",
        ],
    )

    return {"total": len(out_rows), "matched": matched, "unmatched": unmatched}


def build_neighborhood_key_map() -> dict[str, int]:
    profile_rows = load_csv(DATA_DIR / "fy26_route_n_profiles_all.csv")
    with (DATA_DIR / "neighborhoods.geojson").open(encoding="utf-8") as f:
        neighborhoods_geo = json.load(f)

    geo_hoods = sorted(
        {
            (feat.get("properties") or {}).get("hood", "").strip()
            for feat in neighborhoods_geo.get("features", [])
            if (feat.get("properties") or {}).get("hood", "").strip()
        }
    )
    norm_geo = {normalize_text(n): n for n in geo_hoods}

    out_rows: list[dict[str, str]] = []
    unmatched_rows: list[dict[str, str]] = []
    unmatched = 0
    matched = 0

    for row in sorted(profile_rows, key=lambda r: (r.get("neighborhood") or "")):
        source = (row.get("neighborhood") or "").strip()
        key = normalize_text(source)
        canonical = norm_geo.get(key, "")
        ok = bool(canonical)
        if ok:
            matched += 1
        else:
            unmatched += 1
        out_rows.append(
            {
                "source_neighborhood": source,
                "normalized_key": key,
                "canonical_neighborhood_geojson_hood": canonical,
                "match_rule": "normalized_exact" if ok else "manual_review_needed",
            }
        )
        if not ok:
            unmatched_rows.append(out_rows[-1])

    write_csv(
        OUT_DIR / "neighborhood_key_map.csv",
        out_rows,
        [
            "source_neighborhood",
            "normalized_key",
            "canonical_neighborhood_geojson_hood",
            "match_rule",
        ],
    )
    write_csv(
        OUT_DIR / "neighborhood_key_map_unmatched.csv",
        unmatched_rows,
        [
            "source_neighborhood",
            "normalized_key",
            "canonical_neighborhood_geojson_hood",
            "match_rule",
        ],
    )

    return {"total": len(out_rows), "matched": matched, "unmatched": unmatched}


def main() -> None:
    route_stats = build_route_key_map()
    hood_stats = build_neighborhood_key_map()
    print(
        "route_key_map.csv",
        route_stats["total"],
        route_stats["matched"],
        route_stats["unmatched"],
    )
    print(
        "neighborhood_key_map.csv",
        hood_stats["total"],
        hood_stats["matched"],
        hood_stats["unmatched"],
    )


if __name__ == "__main__":
    main()
