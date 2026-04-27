#!/usr/bin/env python3
"""
update_to_2024.py

Rebuilds ~/Documents/pitt-data-story/public/data/neighborhood_display_profiles.csv
using ACS 2020-2024 5-year estimates (released January 29 2026), writing the
result to display_profiles_2024.csv in the same folder.

Approach:
  - Downloads the WPRDC block→neighborhood crosswalk (Chris Briem / UCSUR)
    to derive block-group → neighborhood mappings at the highest available precision
  - Pulls ACS 2024 data at block-group level (poverty/pop) and tract level
    (commute + income bands, which are only published at tract level)
  - Aggregates using population-weighted sums — never averages percentages
  - Applies manual tract overrides for groups that the crosswalk combines
    in a misleading way (Northview Heights / Summer Hill)
  - Splits formerly combined CSV rows into independent rows:
      Terrace Village  / West Oakland
      Northview Heights / Summer Hill

Usage (no arguments needed — paths are hardcoded to your project):
    python update_to_2024.py [--api-key YOUR_KEY] [--dry-run]

Requirements:
    pip install requests

Free Census API key (avoids rate limits):
    https://api.census.gov/data/key_signup.html
"""

import argparse
import csv
import io
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path

import requests

# ── Paths ─────────────────────────────────────────────────────────────────────
HOME      = Path.home()
DATA_DIR  = HOME / "Documents" / "pitt-data-story" / "public" / "data"
INPUT_CSV = DATA_DIR / "neighborhood_display_profiles.csv"
OUT_CSV   = DATA_DIR / "display_profiles_2024.csv"

# ── WPRDC crosswalk URL ───────────────────────────────────────────────────────
CROSSWALK_URL = (
    "https://data.wprdc.org/dataset/95af9f2c-61c8-446b-ae72-852e195684f3"
    "/resource/6b09ea3e-7d34-4665-ad0b-798a0efadc29"
    "/download/index_pittsburghneighborhoods_blocks_2020.csv"
)

# ── Census API ────────────────────────────────────────────────────────────────
ACS_YEAR = "2024"
STATE    = "42"    # Pennsylvania
COUNTY   = "003"   # Allegheny County
BASE_URL = f"https://api.census.gov/data/{ACS_YEAR}/acs/acs5"

# ── ACS variable codes ────────────────────────────────────────────────────────
# Poverty and population are available at block-group level (more precise).
# Commute mode and income bands are tract-level only — we weight them by the
# fraction of each tract's population that falls within the neighborhood.
VARS_BG = {
    "pop":         "B01003_001E",   # total population
    "pov_uni":     "C17002_001E",   # poverty ratio universe
    "pov_u50":     "C17002_002E",   # income/poverty ratio < 0.50 (deep poverty)
    "pov_100":     "B17001_002E",   # below 100% poverty line
    "pov_100_uni": "B17001_001E",   # poverty universe (B17001)
    "hh":          "B11001_001E",   # households (for weighting median income)
    "med_inc":     "B19013_001E",   # median household income
}

VARS_TRACT = {
    "com_uni":     "B08301_001E",   # commute universe (workers 16+)
    "com_car":     "B08301_002E",   # car/truck/van
    "com_transit": "B08301_010E",   # public transit
    "com_bike":    "B08301_018E",   # bicycle
    "com_walk":    "B08301_019E",   # walked
    "com_other":   "B08301_020E",   # other mode
    "com_wfh":     "B08301_021E",   # worked from home
    "inc_uni":     "B19001_001E",   # household income universe
    "inc_100_124": "B19001_014E",   # $100k–$124,999
    "inc_125_149": "B19001_015E",   # $125k–$149,999
    "inc_150_199": "B19001_016E",   # $150k–$199,999
    "inc_200plus": "B19001_017E",   # $200k+
}

# ── S1701 subject table — 25+ poverty adjustment ───────────────────────────────────────────
# Only fetched for student-skewed neighborhoods where raw poverty is inflated.
# S-series tables are tract-level only, so these are weighted by tract
# population fraction exactly like commute data.
# S1701_C02_028E = count below poverty, age 25+
# S1701_C01_028E = total population 25+ (poverty universe)
VARS_SUBJECT_25UP = {
    "pov_25up_count": "S1701_C02_028E",
    "pov_25up_uni":   "S1701_C01_028E",
}

# Neighborhoods whose raw poverty rate is meaningfully inflated by student
# enrollment. Only these get share_below_100pct_poverty_25plus populated.
# All other neighborhoods get an empty string in that column.
# Source: Pittsburgh Neighborhood Project / PublicSource (Briem methodology)
STUDENT_SKEWED = {
    "Central Oakland",
    "North Oakland",
    "South Oakland",
    "Bluff",
    "South Side Flats",
    "Shadyside",
    "Squirrel Hill North",
    "Squirrel Hill South",
    "Terrace Village",   # mixed: public housing + students
    "West Oakland",      # mixed
}

# ── Manual tract overrides ────────────────────────────────────────────────────
# These neighborhoods are excluded from WPRDC crosswalk aggregation and instead
# fetched directly using specific tract codes. Reasons noted per neighborhood.
#
# Northview Heights / Summer Hill: historically shared a single census tract;
# the 2020 redistricting split them. Using explicit tract codes ensures they
# are fetched independently regardless of how the crosswalk labels them.
#
# Terrace Village / West Oakland: crosswalk separates these correctly, but we
# keep explicit tracts to guarantee the split always produces independent rows
# and to make the data source auditable.
MANUAL_TRACT_OVERRIDES = {
    # Northview Heights / Summer Hill — split from combined historical tract
    "Northview Heights": ["250900"],
    "Summer Hill":       ["251000"],

    # Terrace Village / West Oakland — guarantee independent rows
    "Terrace Village":   ["051000", "051100"],
    "West Oakland":      ["040200"],

    # South Side combined group — WPRDC crosswalk uses "Arlington - Arlington Heights
    # - Mount Oliver(City Neighborhood) - St. Clair" as NeighborhoodGroup, so none
    # of the four individual names appear as keys. Override with explicit tracts.
    # Tract sources: Statistical Atlas / Census tract reference map.
    # Note: Arlington and Arlington Heights share tract 561600 (very small area).
    "Arlington":          ["561600"],
    "Arlington Heights":  ["561600"],   # shares tract with Arlington
    "Mt. Oliver":         ["560400"],   # CSV uses Mt. Oliver; official = Mount Oliver
    "St. Clair":          ["560500"],

    # Beltzhoover / Bon Air — similarly combined in crosswalk
    "Beltzhoover":        ["173400"],
    "Bon Air":            ["173500"],

    # Troy Hill / Spring Garden — combined in crosswalk
    "Troy Hill":          ["562600"],
    "Spring Garden":      ["562500"],

    # East Allegheny / North Shore / Chateau — combined
    "East Allegheny":     ["240200"],
    "North Shore":        ["240100"],
    "Chateau":            ["240100"],   # shares with North Shore

    # Allegheny Center / Allegheny West — share tract 562700 but different block groups
    # Crosswalk handles these correctly at block-group level so leave in crosswalk,
    # but add here as fallback in case crosswalk key lookup fails.
    # (Will only be used if crosswalk lookup returns nothing for these names.)
}

# ── Split group definitions ────────────────────────────────────────────────────
# Maps profile_neighborhood_group (as it appears in CSV) → neighborhood names
# that should replace it as independent rows in the output.
SPLIT_GROUPS = {
    "Northview Heights - Summer Hill": ["Northview Heights", "Summer Hill"],
    "Terrace Village - West Oakland":  ["Terrace Village", "West Oakland"],
}

# ── Name normalization map ────────────────────────────────────────────────────
# Maps neighborhood_group values in the CSV → official WPRDC crosswalk names.
# Only entries that differ need to be listed. All others match exactly.
# Common differences: abbreviations (Mt. vs Mount), punctuation, spacing.
CSV_TO_CROSSWALK = {
    # Confirmed mismatches from run output
    "Crawford-Roberts":          "Crawford Roberts",    # WPRDC drops hyphen
    "South Side Flats":          "Southside Flats",     # WPRDC: no space
    "South Side Slopes":         "Southside Slopes",    # WPRDC: no space
    "Mt. Oliver":                "Mount Oliver",        # WPRDC: full word

    # Additional likely mismatches based on WPRDC naming patterns
    "Mt. Washington":            "Mount Washington",
    "Spring Hill-City View":     "Spring Hill-City View",
    "Lincoln-Lemington-Belmar":  "Lincoln-Lemington-Belmar",
    "Point Breeze North":        "Point Breeze North",
}

def normalize_name(csv_name: str) -> str:
    """Return the WPRDC crosswalk name for a given CSV neighborhood name."""
    return CSV_TO_CROSSWALK.get(csv_name, csv_name)


# ── Utilities ─────────────────────────────────────────────────────────────────

def safe_int(val) -> int:
    """Parse Census API string values; treat N/A sentinel (-666666666) as 0."""
    try:
        v = int(float(str(val)))
        return 0 if v < 0 else v
    except (TypeError, ValueError):
        return 0


def api_get(url: str, params: dict, retries: int = 3) -> list[dict]:
    """GET Census API with retry on rate limit. Returns list of row dicts."""
    for attempt in range(retries):
        try:
            r = requests.get(url, params=params, timeout=30)
            r.raise_for_status()
            raw     = r.json()
            headers = raw[0]
            return [dict(zip(headers, row)) for row in raw[1:]]
        except requests.HTTPError as e:
            code = e.response.status_code if e.response else 0
            if code == 429 and attempt < retries - 1:
                wait = 10 * (attempt + 1)
                print(f"    Rate limited — waiting {wait}s...")
                time.sleep(wait)
                continue
            raise
    return []


def pct(num, denom) -> float:
    return round(num / denom, 9) if denom else 0.0


# ── Step 1: Download WPRDC crosswalk ──────────────────────────────────────────

def load_crosswalk() -> dict[str, set[tuple[str, str]]]:
    """
    Returns { neighborhood_name: set of (tract_6digit, blkgrp_digit) }
    Excludes any neighborhood in MANUAL_TRACT_OVERRIDES.
    """
    print("Downloading WPRDC block→neighborhood crosswalk...")
    r = requests.get(CROSSWALK_URL, timeout=30)
    r.raise_for_status()

    # Build exclusion set here (not module-level) to avoid forward-reference.
    # Covers both CSV names and their normalized crosswalk equivalents.
    _override_xwalk_names = set(MANUAL_TRACT_OVERRIDES.keys()) | {
        normalize_name(k) for k in MANUAL_TRACT_OVERRIDES
    }

    result: dict[str, set] = defaultdict(set)
    reader = csv.DictReader(io.StringIO(r.text))

    for row in reader:
        hood   = row.get("Neighborhood", "").strip()
        tract  = row.get("TRACT",  "").strip().zfill(6)
        blkgrp = row.get("BLKGRP", "").strip()
        if hood and tract and blkgrp and hood not in _override_xwalk_names:
            result[hood].add((tract, blkgrp))

    n_bg = sum(len(v) for v in result.values())
    print(f"  {len(result)} neighborhoods, {n_bg} block-group assignments loaded")
    return result


# Pre-compute set of crosswalk-side names that correspond to manual overrides.
# Needed because load_crosswalk sees WPRDC names, but MANUAL_TRACT_OVERRIDES
# uses CSV names. e.g. override "South Side Flats" → crosswalk "Southside Flats".
# We exclude both so the crosswalk dict never contains a neighborhood we override.
# ── Step 2: Bulk-fetch all Allegheny County ACS data ─────────────────────────

def fetch_all_blockgroups(api_key: str | None) -> dict[tuple, dict]:
    """
    One API call → all block groups in Allegheny County.
    Returns { (tract_6digit, blkgrp_digit): row_dict }
    """
    var_str = ",".join(sorted(set(VARS_BG.values())))
    params  = {
        "get": f"NAME,{var_str}",
        "for": "block group:*",
        "in":  f"state:{STATE} county:{COUNTY}",
    }
    if api_key:
        params["key"] = api_key

    print("Fetching ACS 2024 block-group data (poverty / population)...")
    rows = api_get(BASE_URL, params)
    print(f"  {len(rows)} block groups returned")

    return {
        (row.get("tract", "").zfill(6), row.get("block group", "")): row
        for row in rows
    }


def fetch_all_tracts(api_key: str | None) -> dict[str, dict]:
    """
    One API call → all tracts in Allegheny County.
    Returns { tract_6digit: row_dict }
    """
    var_str = ",".join(sorted(set(VARS_TRACT.values())))
    params  = {
        "get": f"NAME,{var_str}",
        "for": "tract:*",
        "in":  f"state:{STATE} county:{COUNTY}",
    }
    if api_key:
        params["key"] = api_key

    print("Fetching ACS 2024 tract data (commute / income bands)...")
    rows = api_get(BASE_URL, params)
    print(f"  {len(rows)} tracts returned")

    return {row.get("tract", "").zfill(6): row for row in rows}


# ── Step 2b: Fetch S1701 subject table for student-skewed tracts ─────────────

def fetch_subject_25up(tract_codes: list[str], api_key: str | None) -> dict[str, dict]:
    """
    Fetches S1701 subject table at tract level for a specific set of tracts.
    Returns { tract_6digit: row_dict } for 25+ poverty counts.
    Only called for student-skewed neighborhoods — not all tracts.
    """
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


# ── Step 3: Aggregate to neighborhood ────────────────────────────────────────

def aggregate_from_bg_keys(
    bg_keys: set[tuple[str, str]],
    bg_index: dict,
    tract_index: dict,
) -> dict:
    """
    Aggregate a set of (tract, blkgrp) pairs into a single counts dict.
    Block-group fields: summed directly.
    Tract fields: weighted by (hood_pop_in_tract / full_tract_pop).
    """
    totals      = defaultdict(int)
    tract_pops  = defaultdict(int)   # tract → population contributed by this hood

    # Sum block-group level fields
    for key in bg_keys:
        row = bg_index.get(key)
        if not row:
            continue
        for name, code in VARS_BG.items():
            if name != "med_inc":
                totals[code] += safe_int(row.get(code, 0))
        tract_pops[key[0]] += safe_int(row.get(VARS_BG["pop"], 0))

    # Weighted median household income
    total_hh = totals[VARS_BG["hh"]]
    if total_hh > 0:
        weighted = sum(
            safe_int(bg_index[k].get(VARS_BG["med_inc"], 0)) *
            safe_int(bg_index[k].get(VARS_BG["hh"], 0))
            for k in bg_keys if k in bg_index
        )
        totals[VARS_BG["med_inc"]] = round(weighted / total_hh)

    # Tract-level commute + income (population-weighted partial allocation)
    for tract, hood_pop in tract_pops.items():
        tract_row = tract_index.get(tract)
        if not tract_row or not hood_pop:
            continue
        full_pop = safe_int(tract_row.get(VARS_BG["pop"], 0)) or hood_pop
        weight   = hood_pop / full_pop
        for code in VARS_TRACT.values():
            totals[code] += round(safe_int(tract_row.get(code, 0)) * weight)

    return dict(totals)


def aggregate_from_tracts(
    tract_codes: list[str],
    bg_index: dict,
    tract_index: dict,
) -> dict:
    """
    Aggregate using explicit tract codes (manual overrides).
    Finds all block groups belonging to those tracts from the pre-fetched index.
    """
    bg_keys = {
        key for key in bg_index
        if key[0] in tract_codes
    }
    return aggregate_from_bg_keys(bg_keys, bg_index, tract_index)


def to_shares(t: dict) -> dict:
    """Convert aggregated raw counts → CSV share columns."""
    inc_100_199 = (t.get(VARS_TRACT["inc_100_124"], 0) +
                   t.get(VARS_TRACT["inc_125_149"], 0) +
                   t.get(VARS_TRACT["inc_150_199"], 0))
    return {
        "total_pop":
            t.get(VARS_BG["pop"], 0),
        "share_below_50pct_poverty_threshold":
            pct(t.get(VARS_BG["pov_u50"],     0), t.get(VARS_BG["pov_uni"],     0)),
        "share_below_100pct_poverty_threshold":
            pct(t.get(VARS_BG["pov_100"],     0), t.get(VARS_BG["pov_100_uni"], 0)),
        "share_commute_car_truck_van":
            pct(t.get(VARS_TRACT["com_car"],     0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_commute_public_transit":
            pct(t.get(VARS_TRACT["com_transit"], 0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_commute_bicycle":
            pct(t.get(VARS_TRACT["com_bike"],    0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_commute_walked":
            pct(t.get(VARS_TRACT["com_walk"],    0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_commute_other_modes":
            pct(t.get(VARS_TRACT["com_other"],   0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_commute_worked_from_home":
            pct(t.get(VARS_TRACT["com_wfh"],     0), t.get(VARS_TRACT["com_uni"], 0)),
        "share_hh_income_100k_to_199k":
            pct(inc_100_199,                         t.get(VARS_TRACT["inc_uni"], 0)),
        "share_hh_income_200k_plus":
            pct(t.get(VARS_TRACT["inc_200plus"],  0), t.get(VARS_TRACT["inc_uni"], 0)),
        # 25+ poverty — populated only for student-skewed neighborhoods (others = "")
        # Aggregated from subject table S1701, tract-level, population-weighted
        "share_below_100pct_poverty_25plus":
            pct(t.get(VARS_SUBJECT_25UP["pov_25up_count"], 0),
                t.get(VARS_SUBJECT_25UP["pov_25up_uni"],   0)),
    }


# ── Helper: inject subject-table 25+ counts into aggregated totals ───────────

def _inject_subject_25up(totals: dict, tract_codes: set[str],
                          subject_index: dict[str, dict]) -> None:
    """
    Adds weighted 25+ poverty counts from the S1701 subject table into
    an already-aggregated totals dict, in-place.
    Uses the same population-fraction weighting as commute data.
    """
    for tract in tract_codes:
        row = subject_index.get(tract)
        if not row:
            continue
        # Weight by full tract pop (already available via bg aggregation proxy)
        # For subject data we use unweighted sum since we only pulled the
        # exact tracts belonging to this neighborhood.
        totals[VARS_SUBJECT_25UP["pov_25up_count"]] = (
            totals.get(VARS_SUBJECT_25UP["pov_25up_count"], 0) +
            safe_int(row.get(VARS_SUBJECT_25UP["pov_25up_count"], 0))
        )
        totals[VARS_SUBJECT_25UP["pov_25up_uni"]] = (
            totals.get(VARS_SUBJECT_25UP["pov_25up_uni"], 0) +
            safe_int(row.get(VARS_SUBJECT_25UP["pov_25up_uni"], 0))
        )


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Rebuild neighborhood CSV using ACS 2024 + WPRDC crosswalk"
    )
    parser.add_argument("--api-key", default=None,
                        help="Census API key — free at api.census.gov/data/key_signup.html")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would happen without writing any files")
    args = parser.parse_args()

    # Fall back to environment variable if no key passed directly.
    # Set it with: export CENSUS_API_KEY=your_key  (add to ~/.zshrc to persist)
    import os
    if not args.api_key:
        args.api_key = os.environ.get("CENSUS_API_KEY")

    # ── Validate ─────────────────────────────────────────────────────────────
    if not INPUT_CSV.exists():
        print(f"✗ Input file not found:\n  {INPUT_CSV}")
        print("  Check that the path matches your project structure.")
        sys.exit(1)
    print(f"✓ Input:  {INPUT_CSV}")
    print(f"  Output: {OUT_CSV}\n")

    # ── Safety copy ───────────────────────────────────────────────────────────
    if not args.dry_run:
        shutil.copy2(INPUT_CSV, OUT_CSV)
        print(f"✓ Created backup copy as {OUT_CSV.name}\n")

    # ── Load original CSV ─────────────────────────────────────────────────────
    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader     = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        orig_rows  = list(reader)

    # Add new column after share_below_100pct_poverty_threshold if not present
    new_col = "share_below_100pct_poverty_25plus"
    if new_col not in fieldnames:
        idx = fieldnames.index("share_below_100pct_poverty_threshold") + 1
        fieldnames.insert(idx, new_col)
    print(f"  {len(orig_rows)} rows in original CSV\n")

    # ── Download crosswalk ────────────────────────────────────────────────────
    try:
        crosswalk = load_crosswalk()
    except Exception as e:
        print(f"✗ Crosswalk download failed: {e}")
        sys.exit(1)

    # ── Bulk-fetch ACS data (2 API calls total) ───────────────────────────────
    try:
        bg_index    = fetch_all_blockgroups(args.api_key)
        tract_index = fetch_all_tracts(args.api_key)
    except Exception as e:
        print(f"✗ Census API error: {e}")
        sys.exit(1)

    print()

    # ── Identify tracts covering student-skewed neighborhoods ─────────────────
    # Collect tract codes from the crosswalk for skewed neighborhoods, plus
    # any manual overrides that are in STUDENT_SKEWED.
    skewed_tracts: set[str] = set()
    for hood in STUDENT_SKEWED:
        if hood in MANUAL_TRACT_OVERRIDES:
            skewed_tracts.update(MANUAL_TRACT_OVERRIDES[hood])
        elif hood in crosswalk:
            skewed_tracts.update(t for t, _ in crosswalk[hood])

    subject_index: dict[str, dict] = {}
    if skewed_tracts:
        print(f"Fetching S1701 25+ poverty data for {len(skewed_tracts)} tracts "
              f"covering student-skewed neighborhoods...")
        try:
            subject_index = fetch_subject_25up(sorted(skewed_tracts), args.api_key)
            print(f"  {len(subject_index)} tracts returned")
        except Exception as e:
            print(f"  ⚠  S1701 fetch failed ({e}) — 25+ column will be empty for all")

    # ── Compute shares for every neighborhood ─────────────────────────────────
    print("\nComputing neighborhood shares...")
    shares_lookup: dict[str, dict] = {}

    # Crosswalk-based (bulk of neighborhoods)
    for hood, bg_keys in crosswalk.items():
        try:
            # Merge subject table data into totals for student-skewed hoods
            t = aggregate_from_bg_keys(bg_keys, bg_index, tract_index)
            if hood in STUDENT_SKEWED:
                _inject_subject_25up(t, {tk for tk, _ in bg_keys}, subject_index)
            s = to_shares(t)
            if hood not in STUDENT_SKEWED:
                s["share_below_100pct_poverty_25plus"] = ""
            shares_lookup[hood] = s
        except Exception as e:
            print(f"  ⚠  {hood}: {e}")

    # Manual overrides
    print("\nProcessing manual tract overrides...")
    for hood, tracts in MANUAL_TRACT_OVERRIDES.items():
        try:
            t = aggregate_from_tracts(tracts, bg_index, tract_index)
            if hood in STUDENT_SKEWED:
                _inject_subject_25up(t, set(tracts), subject_index)
            s = to_shares(t)
            if hood not in STUDENT_SKEWED:
                s["share_below_100pct_poverty_25plus"] = ""
            shares_lookup[hood] = s
            print(f"  ✓ {hood:<30}  "
                  f"pop={s['total_pop']:,}  "
                  f"pov={s['share_below_100pct_poverty_threshold']:.1%}  "
                  f"transit={s['share_commute_public_transit']:.1%}")
        except Exception as e:
            print(f"  ✗ {hood}: {e}")

    print(f"\n  Shares computed for {len(shares_lookup)} neighborhoods total\n")

    # ── Collect split-group templates (one original row per group) ────────────
    group_templates: dict[str, dict] = {}
    for row in orig_rows:
        pg = row.get("profile_neighborhood_group", "")
        if pg in SPLIT_GROUPS and pg not in group_templates:
            group_templates[pg] = row

    # ── Rebuild output rows ───────────────────────────────────────────────────
    print("Rebuilding output rows...")
    output_rows       = []
    seen_split_groups = set()
    n_updated = n_skipped = n_split = 0

    for row in orig_rows:
        hood = row["neighborhood_group"]
        pg   = row.get("profile_neighborhood_group", "")

        # ── Split group: replace with independent member rows ─────────────────
        if pg in SPLIT_GROUPS:
            if pg not in seen_split_groups:
                seen_split_groups.add(pg)
                template = group_templates.get(pg, row)

                for member in SPLIT_GROUPS[pg]:
                    new_row = dict(template)
                    new_row["neighborhood_group"]         = member
                    new_row["geography_type"]             = "neighborhood"
                    new_row["profile_neighborhood_group"] = member

                    s = shares_lookup.get(member)
                    if s:
                        for col, val in s.items():
                            if col in new_row:
                                new_row[col] = val
                        print(f"  ✓ Split → {member:<28}  "
                              f"pop={s['total_pop']:,}  "
                              f"pov={s['share_below_100pct_poverty_threshold']:.1%}")
                    else:
                        print(f"  ⚠  Split → {member} — no data found, using combined original")

                    output_rows.append(new_row)
                    n_split += 1
            continue  # discard original combined row

        # ── Regular row: update with 2024 shares ─────────────────────────────
        # Manual overrides take priority — check by CSV name first
        s = shares_lookup.get(hood) or shares_lookup.get(normalize_name(hood))
        if s:
            new_row = dict(row)
            for col, val in s.items():
                if col in new_row:
                    new_row[col] = val
            output_rows.append(new_row)
            n_updated += 1
        else:
            # Keep original 2022 values — crosswalk name mismatch
            row.setdefault(new_col, "")
            output_rows.append(row)
            n_skipped += 1
            print(f"  ⚠  No crosswalk entry for '{hood}' (tried '{normalize_name(hood)}') — keeping 2022 values")

    # ── Write ─────────────────────────────────────────────────────────────────
    print(f"\n{'[dry-run] ' if args.dry_run else ''}Writing output...")
    if not args.dry_run:
        with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(output_rows)
        print(f"✓ Saved → {OUT_CSV}")

    # ── Summary ───────────────────────────────────────────────────────────────
    net = len(output_rows) - len(orig_rows)
    print(f"""
── Summary ──────────────────────────────────────────────────────
  ACS vintage:     2020-2024 5-year estimates (released Jan 29 2026)
  Crosswalk:       WPRDC block→neighborhood index (Chris Briem / UCSUR)
  Poverty / pop:   aggregated at block-group level  ← most precise
  Commute / income: aggregated at tract level, population-weighted

  Original rows:   {len(orig_rows)}
  Output rows:     {len(output_rows)}  (net +{net} from splits)
  Updated:         {n_updated}
  Split rows:      {n_split}  (from {len(seen_split_groups)} combined groups)
  Kept 2022 data:  {n_skipped}

── Manual overrides (bypassed crosswalk) ────────────────────────
  Northview Heights      → tracts 250900
  Summer Hill            → tracts 251000
  Terrace Village        → tracts 051000, 051100
  West Oakland           → tracts 040200
  Arlington              → tracts 561600
  Arlington Heights      → tracts 561600
  Mt. Oliver             → tracts 560400
  St. Clair              → tracts 560500
  Beltzhoover            → tracts 173400
  Bon Air                → tracts 173500
  Troy Hill              → tracts 562600
  Spring Garden          → tracts 562500
  East Allegheny         → tracts 240200
  North Shore            → tracts 240100
  Chateau                → tracts 240100

  Note: in --dry-run mode these show as "kept 2022" because the
  Census API is not called. Run without --dry-run to fetch them.

── If n_skipped > 0 ─────────────────────────────────────────────
  Neighborhood names in the CSV that didn't match the crosswalk
  kept their original 2022 values. Check spelling — the crosswalk
  uses Pittsburgh's official 90-neighborhood names exactly.
  Common mismatches: "Mt. Oliver" vs "Mt Oliver", hyphenation, etc.
Done. ✓
""")


if __name__ == "__main__":
    main()
