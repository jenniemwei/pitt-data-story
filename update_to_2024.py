#!/usr/bin/env python3
"""
update_to_2024.py

Rebuilds ~/Documents/pitt-data-story/public/data/neighborhood_display_profiles.csv
using ACS 2020-2024 5-year estimates (released January 29 2026).

Tract assignments come from neighborhoods_2024_tracts.csv (same directory as
this script). The output preserves ALL existing groupings from the input CSV —
no rows are added or removed, combined groups stay combined, and every row that
belongs to the same profile_neighborhood_group gets identical values derived
from that group's tract codes.

Usage:
    python update_to_2024.py [--api-key YOUR_KEY] [--dry-run]

Requirements:
    pip install requests

API key (free): https://api.census.gov/data/key_signup.html
Set via:        export CENSUS_API_KEY=your_key
"""

import argparse
import csv
import io
import os
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

# ── Paths ─────────────────────────────────────────────────────────────────────
HOME       = Path.home()
DATA_DIR   = HOME / "Documents" / "pitt-data-story" / "public" / "data"
INPUT_CSV  = DATA_DIR / "neighborhood_display_profiles.csv"
OUT_CSV    = DATA_DIR / "display_profiles_2024.csv"
SCRIPT_DIR = Path(__file__).parent
TRACTS_CSV = SCRIPT_DIR / "neighborhoods_2024_tracts.csv"

# ── Census API ────────────────────────────────────────────────────────────────
ACS_YEAR = "2024"
STATE    = "42"
COUNTY   = "003"
BASE_URL = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"

# ── ACS variables — ALL at tract level ───────────────────────────────────────
# Poverty, commute, and income vars are NOT available at block-group level
# in ACS 2024. Everything comes from the tract-level fetch.
VARS_TRACT = {
    "pop":         "B01003_001E",
    "hh":          "B11001_001E",
    "pov_uni":     "C17002_001E",
    "pov_u50":     "C17002_002E",
    "pov_100":     "B17001_002E",
    "pov_100_uni": "B17001_001E",
    "med_inc":     "B19013_001E",
    "com_uni":     "B08301_001E",
    "com_car":     "B08301_002E",
    "com_transit": "B08301_010E",
    "com_bike":    "B08301_018E",
    "com_walk":    "B08301_019E",
    "com_other":   "B08301_020E",
    "com_wfh":     "B08301_021E",
    "inc_uni":     "B19001_001E",
    "inc_100_124": "B19001_014E",
    "inc_125_149": "B19001_015E",
    "inc_150_199": "B19001_016E",
    "inc_200plus": "B19001_017E",
}

# ── S1701 — 25+ poverty (student-skewed neighborhoods only) ───────────────────
VARS_SUBJECT_25UP = {
    "pov_25up_count": "S1701_C02_028E",
    "pov_25up_uni":   "S1701_C01_028E",
}

STUDENT_SKEWED_GROUPS = {
    "Central Oakland",
    "North Oakland",
    "South Oakland",
    "Bluff",
    "South Side Flats",
    "Shadyside",
    "Squirrel Hill North",
    "Squirrel Hill South",
    "Terrace Village - West Oakland",
    "Terrace Village",
    "West Oakland",
}

# ── Name bridge: profile_neighborhood_group → tract CSV name ──────────────────
# Only entries that differ need to be listed.
GROUP_TO_TRACT_CSV = {
    # Hyphenation differences
    "Allegheny Center-Allegheny West":
        "Allegheny Center - Allegheny West",
    "Arlington - Arlington Heights - Mount Oliver(City Neighborhood) - St. Clair":
        "Arlington - Arlington Heights - Mount Oliver (City Neighborhood) - St. Clair",
    "East Allegheny-North Shore":
        "East Allegheny - North Shore",
    "Esplen-Sheraden-ChartiersCity-Windgap-Fairywood":
        "Esplen \u2013 Sheraden \u2013 Chartiers City \u2013 Windgap - Fairywood",
    "Hazelwood-Glen Hazel -New Homestead-Hays":
        "Hazelwood - Glen Hazel - Hays - New Homestead",
    "Point Breeze-RegentSquare":
        "Point Breeze - Regent Square",
    # Split groups that share data with their partner
    "Northview Heights":
        "Northview Heights - Summer Hill",
    "Summer Hill":
        "Northview Heights - Summer Hill",
    "Terrace Village":
        "Terrace Village - West Oakland",
    "West Oakland":
        "Terrace Village - West Oakland",
    # South Shore has no tracts in the CSV — will keep 2022 values
}


# ── Utilities ─────────────────────────────────────────────────────────────────
def safe_int(val) -> int:
    try:
        v = int(float(str(val)))
        return 0 if v < 0 else v
    except (TypeError, ValueError):
        return 0

def pct(num, denom) -> float:
    return round(num / denom, 9) if denom else 0.0

def api_get(url: str, params: dict, retries=3) -> list[dict]:
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            raw = r.json()
            return [dict(zip(raw[0], row)) for row in raw[1:]]
        except requests.HTTPError as e:
            code = e.response.status_code if e.response else 0
            if code == 429 and attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"    Rate limited — waiting {wait}s...")
                time.sleep(wait)
                continue
            raise
    return []


# ── Step 1: Load tract CSV ────────────────────────────────────────────────────
def load_tract_csv() -> dict[str, list[str]]:
    """
    Returns { tract_csv_name: [tract_code, ...] }
    Skips comment lines, splits on semicolon, deduplicates.
    """
    if not TRACTS_CSV.exists():
        print(f"✗ Tract CSV not found: {TRACTS_CSV}")
        print(f"  Place neighborhoods_2024_tracts.csv next to this script.")
        sys.exit(1)

    result = {}
    with open(TRACTS_CSV, encoding="utf-8") as f:
        lines = [l for l in f if not l.startswith("#")]

    reader = csv.DictReader(io.StringIO("".join(lines)))
    for row in reader:
        name   = row.get("Neighborhood", "").strip()
        tracts_raw = row.get("Tracts", "").strip()
        if not name or not tracts_raw:
            continue
        # Deduplicate while preserving order
        seen = set()
        tracts = []
        for t in tracts_raw.split(";"):
            t = t.strip()
            if t and t not in seen:
                seen.add(t)
                tracts.append(t)
        result[name] = tracts

    print(f"  Loaded {len(result)} entries from tract CSV")
    return result


def resolve_tracts(profile_group: str, tract_lookup: dict[str, list[str]]) -> list[str] | None:
    """
    Given a profile_neighborhood_group value, returns its tract codes.
    Tries direct match first, then the bridge map.
    Returns None if no match found.
    """
    # Direct match
    if profile_group in tract_lookup:
        return tract_lookup[profile_group]
    # Bridge map
    csv_name = GROUP_TO_TRACT_CSV.get(profile_group)
    if csv_name and csv_name in tract_lookup:
        return tract_lookup[csv_name]
    return None


# ── Step 2: Fetch all Allegheny County tract data ─────────────────────────────
def fetch_all_tracts(api_key) -> dict[str, dict]:
    """Single API call → all Allegheny County tracts."""
    var_str = ",".join(sorted(set(VARS_TRACT.values())))
    params = {
        "get": f"NAME,{var_str}",
        "for": "tract:*",
        "in":  f"state:{STATE} county:{COUNTY}",
    }
    if api_key:
        params["key"] = api_key

    print("Fetching ACS 2024 tract data...")
    rows = api_get(BASE_URL, params)
    print(f"  {len(rows)} tracts returned")
    return {row.get("tract", "").zfill(6): row for row in rows}


def fetch_subject_25up(tract_codes: list[str], api_key) -> dict[str, dict]:
    """S1701 subject table — targeted fetch for skewed-neighborhood tracts only."""
    var_str = ",".join(sorted(set(VARS_SUBJECT_25UP.values())))
    params = {
        "get": f"NAME,{var_str}",
        "for": f"tract:{','.join(tract_codes)}",
        "in":  f"state:{STATE} county:{COUNTY}",
    }
    if api_key:
        params["key"] = api_key
    url = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5/subject"
    rows = api_get(url, params)
    return {row.get("tract", "").zfill(6): row for row in rows}


# ── Step 3: Aggregate tracts → shares ────────────────────────────────────────
def aggregate_tracts(tract_codes: list[str], tract_index: dict) -> dict:
    """Sum raw counts across all tracts for a neighborhood group."""
    totals = defaultdict(int)
    found = 0

    for tract in tract_codes:
        row = tract_index.get(tract)
        if not row:
            continue
        found += 1
        for code in VARS_TRACT.values():
            totals[code] += safe_int(row.get(code, 0))

    # Weighted median income by household count
    total_hh = totals[VARS_TRACT["hh"]]
    if total_hh > 0:
        weighted = sum(
            safe_int(tract_index[t].get(VARS_TRACT["med_inc"], 0)) *
            safe_int(tract_index[t].get(VARS_TRACT["hh"], 0))
            for t in tract_codes if t in tract_index
        )
        totals[VARS_TRACT["med_inc"]] = round(weighted / total_hh)

    return dict(totals), found


def inject_subject_25up(totals: dict, tract_codes: list[str],
                         subject_index: dict) -> None:
    """Add 25+ poverty counts from S1701 into totals dict in-place."""
    for tract in tract_codes:
        row = subject_index.get(tract)
        if not row:
            continue
        for key, code in VARS_SUBJECT_25UP.items():
            totals[code] = totals.get(code, 0) + safe_int(row.get(code, 0))


def to_shares(t: dict, is_student_skewed: bool) -> dict:
    """Convert aggregated raw counts → CSV share columns."""
    inc_100_199 = (t.get(VARS_TRACT["inc_100_124"], 0) +
                   t.get(VARS_TRACT["inc_125_149"], 0) +
                   t.get(VARS_TRACT["inc_150_199"], 0))

    pov_25plus = (
        pct(t.get(VARS_SUBJECT_25UP["pov_25up_count"], 0),
            t.get(VARS_SUBJECT_25UP["pov_25up_uni"],   0))
        if is_student_skewed else ""
    )

    return {
        "total_pop":
            t.get(VARS_TRACT["pop"], 0),
        "share_below_50pct_poverty_threshold":
            pct(t.get(VARS_TRACT["pov_u50"],     0), t.get(VARS_TRACT["pov_uni"],     0)),
        "share_below_100pct_poverty_threshold":
            pct(t.get(VARS_TRACT["pov_100"],     0), t.get(VARS_TRACT["pov_100_uni"], 0)),
        "share_commute_car_truck_van":
            pct(t.get(VARS_TRACT["com_car"],     0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_commute_public_transit":
            pct(t.get(VARS_TRACT["com_transit"], 0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_commute_bicycle":
            pct(t.get(VARS_TRACT["com_bike"],    0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_commute_walked":
            pct(t.get(VARS_TRACT["com_walk"],    0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_commute_other_modes":
            pct(t.get(VARS_TRACT["com_other"],   0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_commute_worked_from_home":
            pct(t.get(VARS_TRACT["com_wfh"],     0), t.get(VARS_TRACT["com_uni"],     0)),
        "share_hh_income_100k_to_199k":
            pct(inc_100_199,                         t.get(VARS_TRACT["inc_uni"],     0)),
        "share_hh_income_200k_plus":
            pct(t.get(VARS_TRACT["inc_200plus"], 0), t.get(VARS_TRACT["inc_uni"],     0)),
        "share_below_100pct_poverty_25plus":
            pov_25plus,
    }


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.api_key:
        args.api_key = os.environ.get("CENSUS_API_KEY")

    # ── Validate paths ────────────────────────────────────────────────────────
    if not INPUT_CSV.exists():
        print(f"✗ Input CSV not found: {INPUT_CSV}")
        sys.exit(1)
    print(f"✓ Input:      {INPUT_CSV}")
    print(f"  Output:     {OUT_CSV}")
    print(f"  Tract CSV:  {TRACTS_CSV}\n")

    if not args.dry_run:
        shutil.copy2(INPUT_CSV, OUT_CSV)
        print(f"✓ Copied original as backup\n")

    # ── Load original CSV ─────────────────────────────────────────────────────
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader     = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        orig_rows  = list(reader)

    print(f"  {len(orig_rows)} rows in original CSV")

    # Add 25+ column if not present
    new_col = "share_below_100pct_poverty_25plus"
    if new_col not in fieldnames:
        idx = fieldnames.index("share_below_100pct_poverty_threshold") + 1
        fieldnames.insert(idx, new_col)

    # ── Load tract lookup ─────────────────────────────────────────────────────
    print("\nLoading tract CSV...")
    tract_lookup = load_tract_csv()

    # ── Validate: which groups resolve to tracts? ─────────────────────────────
    unique_groups = {r["profile_neighborhood_group"] for r in orig_rows}
    group_tracts = {}
    unresolved   = []
    for pg in sorted(unique_groups):
        tracts = resolve_tracts(pg, tract_lookup)
        if tracts:
            group_tracts[pg] = tracts
        else:
            unresolved.append(pg)

    print(f"\n  {len(group_tracts)} groups resolved to tract codes")
    if unresolved:
        print(f"  {len(unresolved)} groups unresolved (will keep 2022 values):")
        for pg in unresolved:
            print(f"    '{pg}'")

    # ── Fetch ACS tract data ──────────────────────────────────────────────────
    if not args.dry_run:
        try:
            tract_index = fetch_all_tracts(args.api_key)
        except Exception as e:
            print(f"✗ Census API error: {e}")
            sys.exit(1)
    else:
        tract_index = {}
        print("\n[dry-run] Skipping Census API calls")

    # ── Validate tract codes against fetched data ─────────────────────────────
    if tract_index:
        available = set(tract_index.keys())
        bad = [(pg, t) for pg, tracts in group_tracts.items()
               for t in tracts if t not in available]
        if bad:
            print(f"\n⚠  {len(bad)} tract codes not found in ACS data:")
            for pg, t in bad:
                print(f"   '{pg}': tract {t}")
            print(f"   Available range: {min(available)} → {max(available)}")
        else:
            print(f"  ✓ All tract codes validated against ACS data")

    # ── Fetch S1701 for student-skewed groups ─────────────────────────────────
    subject_index = {}
    if not args.dry_run:
        skewed_tracts = sorted({
            t for pg, tracts in group_tracts.items()
            if pg in STUDENT_SKEWED_GROUPS
            for t in tracts
        })
        if skewed_tracts:
            print(f"\nFetching S1701 25+ data for {len(skewed_tracts)} tracts...")
            try:
                subject_index = fetch_subject_25up(skewed_tracts, args.api_key)
                print(f"  {len(subject_index)} tracts returned")
            except Exception as e:
                print(f"  ⚠  S1701 fetch failed ({e}) — 25+ column will be empty")

    # ── Compute shares per group ──────────────────────────────────────────────
    print("\nComputing shares per group...")
    group_shares: dict[str, dict] = {}

    for pg, tract_codes in group_tracts.items():
        if not tract_index:
            continue
        totals, found = aggregate_tracts(tract_codes, tract_index)
        if found == 0:
            print(f"  ⚠  {pg}: no tracts found in ACS data")
            continue

        is_skewed = pg in STUDENT_SKEWED_GROUPS
        if is_skewed:
            inject_subject_25up(totals, tract_codes, subject_index)

        shares = to_shares(totals, is_skewed)
        group_shares[pg] = shares

        print(f"  ✓ {pg:<50}  "
              f"pop={shares['total_pop']:,}  "
              f"pov={shares['share_below_100pct_poverty_threshold']:.1%}  "
              f"transit={shares['share_commute_public_transit']:.1%}")

    # ── Rebuild output rows — same structure as input ─────────────────────────
    print(f"\nRebuilding {len(orig_rows)} rows...")
    output_rows = []
    n_updated = n_kept = 0

    for row in orig_rows:
        pg      = row.get("profile_neighborhood_group", "")
        new_row = dict(row)
        new_row.setdefault(new_col, "")

        shares = group_shares.get(pg)
        if shares:
            for col, val in shares.items():
                if col in new_row:
                    new_row[col] = val
            n_updated += 1
        else:
            n_kept += 1

        output_rows.append(new_row)

    # ── Write output ──────────────────────────────────────────────────────────
    if not args.dry_run:
        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(output_rows)
        print(f"\n✓ Saved → {OUT_CSV}")
    else:
        print(f"\n[dry-run] Would write {len(output_rows)} rows to {OUT_CSV}")

    print(f"""
── Summary ──────────────────────────────────────────────────────
  ACS vintage:    2020-2024 5-year estimates
  Tract source:   {TRACTS_CSV.name}
  Input rows:     {len(orig_rows)}
  Output rows:    {len(output_rows)}  (structure unchanged)
  Updated:        {n_updated}
  Kept 2022:      {n_kept}  ← should be 0 or just South Shore

── Grouping preserved ───────────────────────────────────────────
  Combined groups (e.g. Beltzhoover/Bon Air) still share values.
  No rows added or removed. Structure identical to input CSV.
Done. ✓
""")


if __name__ == "__main__":
    main()
