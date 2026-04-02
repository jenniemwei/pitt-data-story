#!/usr/bin/env python3
"""
Build route-level scatter inputs for RidershipEquityScatter.

Outputs:
  - data/ridership.csv — route_id, avg_daily_riders (weekday recent from FY26)
  - data/route_demographics.csv — route_id, pct_corridor_no_car, neighborhoods_served, y_metric_note
  - data/routes_with_demographics.csv — merged rows for the chart

Y-axis metric (honest limitation): FY26 does not include ACS “zero-vehicle households”
for the anchor geography. We set pct_corridor_no_car to:
  100 - pct_journey_to_work_auto_drove_carpool
i.e. share of workers *not* commuting by car/truck/van (includes transit, walk, bike, WFH).
This is a car-reliance / access proxy along the published anchor, not identical to
“households without a car.” The chart footnote should say so.

Persona flags: Pair A = Allentown (vulnerable), Pair B = Point Breeze North (baseline)
from data/n_shortlist.csv routes_before lists.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FY26 = ROOT / "data" / "FY26_route_status_all.csv"
SHORTLIST = ROOT / "data" / "n_shortlist.csv"
OUT_MERGED = ROOT / "data" / "routes_with_demographics.csv"
OUT_RID = ROOT / "data" / "ridership.csv"
OUT_DEMO = ROOT / "data" / "route_demographics.csv"

Y_NOTE = (
    "100% minus ACS share of workers commuting by car/truck/van in FY26 anchor geography; "
    "proxy for low-car commute patterns, not zero-vehicle household share."
)


def norm_route_code(code: str) -> str:
    s = (code or "").strip()
    if s.isdigit():
        return s.zfill(3)
    return s


def parse_route_list(cell: str) -> set[str]:
    if not cell or not str(cell).strip():
        return set()
    return {norm_route_code(p) for p in str(cell).split(";") if p.strip()}


def load_persona_route_ids() -> tuple[set[str], set[str]]:
    """Routes highlighted for story personas from n_shortlist example neighborhoods."""
    persona_a: set[str] = set()
    persona_b: set[str] = set()
    with SHORTLIST.open(newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            hood = (row.get("neighborhood") or "").strip()
            ex = (row.get("example_type") or "").strip().lower()
            before = parse_route_list(row.get("routes_before") or "")
            if hood == "Allentown" and ex == "vulnerable":
                persona_a |= before
            if hood == "Point Breeze North" and ex == "baseline":
                persona_b |= before
    return persona_a, persona_b


def cut_type_from_status(status: str) -> str:
    s = (status or "").strip().lower()
    if s == "unaffected":
        return "unchanged"
    if s in ("eliminated", "reduced"):
        return s
    return "unchanged"


def main() -> None:
    persona_a, persona_b = load_persona_route_ids()

    ridership_rows: list[dict] = []
    demo_rows: list[dict] = []
    merged: list[dict] = []

    with FY26.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            code = norm_route_code(row.get("route_code", ""))
            if not code:
                continue
            try:
                riders = float(row.get("weekday_avg_riders_recent_2023_2024") or 0)
            except ValueError:
                riders = 0.0
            try:
                pct_car_commute = float(row.get("pct_journey_to_work_auto_drove_carpool") or 0)
            except ValueError:
                pct_car_commute = 0.0
            y_pct = max(0.0, min(100.0, 100.0 - pct_car_commute))
            anchor = (row.get("anchor_neighborhoods") or "").strip()
            schedule = (row.get("schedule_name") or "").strip()
            ct = cut_type_from_status(row.get("route_status", ""))

            ridership_rows.append({"route_id": code, "avg_daily_riders": round(riders, 2)})
            demo_rows.append(
                {
                    "route_id": code,
                    "pct_corridor_no_car": round(y_pct, 2),
                    "neighborhoods_served": anchor,
                    "y_metric_note": Y_NOTE,
                }
            )
            merged.append(
                {
                    "route_id": code,
                    "route_name": schedule,
                    "avg_daily_riders": round(riders, 2),
                    "pct_corridor_no_car": round(y_pct, 2),
                    "cut_type": ct,
                    "neighborhoods_served": anchor,
                    "is_persona_a_route": str(code in persona_a).lower(),
                    "is_persona_b_route": str(code in persona_b).lower(),
                }
            )

    fieldnames_r = ["route_id", "avg_daily_riders"]
    fieldnames_d = ["route_id", "pct_corridor_no_car", "neighborhoods_served", "y_metric_note"]
    fieldnames_m = [
        "route_id",
        "route_name",
        "avg_daily_riders",
        "pct_corridor_no_car",
        "cut_type",
        "neighborhoods_served",
        "is_persona_a_route",
        "is_persona_b_route",
    ]

    OUT_RID.parent.mkdir(parents=True, exist_ok=True)
    for path, rows, fields in [
        (OUT_RID, ridership_rows, fieldnames_r),
        (OUT_DEMO, demo_rows, fieldnames_d),
        (OUT_MERGED, merged, fieldnames_m),
    ]:
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)

    print(f"Wrote {len(merged)} rows to {OUT_MERGED.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
