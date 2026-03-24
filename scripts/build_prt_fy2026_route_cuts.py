#!/usr/bin/env python3
"""
Build data/prt_fy2026_route_cuts.csv from PRT's official March 2025 methodology memo
(PDF: https://www.rideprt.org/siteassets/funding-crisis/methodology.pdf)
proposed February 2026 service reductions.
"""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "prt_fy2026_route_cuts.csv"

# Canonical ridership_route_code for joins (prefer zero-padded numeric + letter suffix; P/G/Y/O routes as-is; rail as in data)
RIDERSHIP_CODE: dict[str, str] = {
    # Bus numeric (from monthly_avg_ridership patterns)
    "1": "001",
    "2": "002",
    "4": "004",
    "6": "006",
    "7": "007",
    "8": "008",
    "11": "011",
    "12": "012",
    "13": "013",
    "14": "014",
    "15": "015",
    "16": "016",
    "17": "017",
    "18": "018",
    "19L": "019L",
    "20": "020",
    "21": "021",
    "22": "022",
    "24": "024",
    "26": "026",
    "27": "027",
    "28X": "028X",
    "29": "029",
    "31": "031",
    "36": "036",
    "38": "038",
    "39": "039",
    "40": "040",
    "41": "041",
    "43": "043",
    "44": "044",
    "48": "048",
    "51": "051",
    "51L": "051L",
    "52L": "052L",
    "53": "053",
    "53L": "053L",
    "54": "054",
    "55": "055",
    "56": "056",
    "57": "057",
    "58": "058",
    "59": "059",
    "60": "060",
    "61A": "061A",
    "61B": "061B",
    "61C": "061C",
    "61D": "061D",
    "64": "064",
    "65": "065",
    "67": "067",
    "69": "069",
    "71": "071",
    "71A": "071A",
    "71B": "071B",
    "71C": "071C",
    "71D": "071D",
    "74": "074",
    "75": "075",
    "77": "077",
    "79": "079",
    "81": "081",
    "82": "082",
    "83": "083",
    "86": "086",
    "87": "087",
    "88": "088",
    "89": "089",
    "91": "091",
    "93": "093",
    # Commuter / branded
    "O1": "O1",
    "O5": "O5",
    "O12": "O12",
    "P1": "P1",
    "P3": "P3",
    "P7": "P7",
    "P10": "P10",
    "P12": "P12",
    "P13": "P13",
    "P16": "P16",
    "P17": "P17",
    "P67": "P67",
    "P68": "P68",
    "P69": "P69",
    "P71": "P71",
    "P76": "P76",
    "P78": "P78",
    "G2": "G2",
    "G3": "G3",
    "G31": "G31",
    "Y1": "Y1",
    "Y45": "Y45",
    "Y46": "Y46",
    "Y47": "Y47",
    "Y49": "Y49",
    # Rail / incline (monthly_avg_ridership)
    "RED": "RED",
    "BLUE": "BLUE",
    "BLLB": "BLLB",
    "BLSV": "BLSV",
    "SLVR": "SLVR",
    "MI": "000",
}

SOURCE = (
    "PRT Planning & Service Development, Memorandum March 2025 "
    "(Proposed February 2026 service cuts); "
    "https://www.rideprt.org/siteassets/funding-crisis/methodology.pdf"
)

# Official efficiency table (October 2024 service levels) — exact route groupings from the memo.
COMMUTER_EFFICIENCY: dict[str, str] = {
    "19L": "high_efficiency_gt_20_pph",
    "51L": "high_efficiency_gt_20_pph",
    "O12": "high_efficiency_gt_20_pph",
    "P17": "high_efficiency_gt_20_pph",
    "P67": "high_efficiency_gt_20_pph",
    "P69": "high_efficiency_gt_20_pph",
    "G31": "high_efficiency_gt_20_pph",
    "Y1": "high_efficiency_gt_20_pph",
    "52L": "moderate_low_efficiency_lt_20_pph",
    "O1": "moderate_low_efficiency_lt_20_pph",
    "P7": "moderate_low_efficiency_lt_20_pph",
    "P10": "moderate_low_efficiency_lt_20_pph",
    "P12": "moderate_low_efficiency_lt_20_pph",
    "P16": "moderate_low_efficiency_lt_20_pph",
    "P71": "moderate_low_efficiency_lt_20_pph",
    "P76": "moderate_low_efficiency_lt_20_pph",
    "G3": "moderate_low_efficiency_lt_20_pph",
    "O5": "very_low_efficiency_lt_100_weekday_riders",
    "P13": "very_low_efficiency_lt_100_weekday_riders",
    "Y45": "very_low_efficiency_lt_100_weekday_riders",
}

NON_COMMUTER_EFFICIENCY: dict[str, str] = {
    "8": "high_efficiency_gt_20_pph",
    "16": "high_efficiency_gt_20_pph",
    "48": "high_efficiency_gt_20_pph",
    "51": "high_efficiency_gt_20_pph",
    "54": "high_efficiency_gt_20_pph",
    "64": "high_efficiency_gt_20_pph",
    "67": "high_efficiency_gt_20_pph",
    "75": "high_efficiency_gt_20_pph",
    "82": "high_efficiency_gt_20_pph",
    "83": "high_efficiency_gt_20_pph",
    "86": "high_efficiency_gt_20_pph",
    "93": "high_efficiency_gt_20_pph",
    "61A": "high_efficiency_gt_20_pph",
    "61B": "high_efficiency_gt_20_pph",
    "61C": "high_efficiency_gt_20_pph",
    "61D": "high_efficiency_gt_20_pph",
    "71A": "high_efficiency_gt_20_pph",
    "71B": "high_efficiency_gt_20_pph",
    "71C": "high_efficiency_gt_20_pph",
    "71D": "high_efficiency_gt_20_pph",
    "P1": "high_efficiency_gt_20_pph",
    "P3": "high_efficiency_gt_20_pph",
    "1": "moderate_efficiency_15_to_20_pph",
    "6": "moderate_efficiency_15_to_20_pph",
    "11": "moderate_efficiency_15_to_20_pph",
    "12": "moderate_efficiency_15_to_20_pph",
    "13": "moderate_efficiency_15_to_20_pph",
    "14": "moderate_efficiency_15_to_20_pph",
    "15": "moderate_efficiency_15_to_20_pph",
    "17": "moderate_efficiency_15_to_20_pph",
    "21": "moderate_efficiency_15_to_20_pph",
    "22": "moderate_efficiency_15_to_20_pph",
    "24": "moderate_efficiency_15_to_20_pph",
    "26": "moderate_efficiency_15_to_20_pph",
    "27": "moderate_efficiency_15_to_20_pph",
    "28X": "moderate_efficiency_15_to_20_pph",
    "29": "moderate_efficiency_15_to_20_pph",
    "31": "moderate_efficiency_15_to_20_pph",
    "38": "moderate_efficiency_15_to_20_pph",
    "39": "moderate_efficiency_15_to_20_pph",
    "41": "moderate_efficiency_15_to_20_pph",
    "43": "moderate_efficiency_15_to_20_pph",
    "44": "moderate_efficiency_15_to_20_pph",
    "53L": "moderate_efficiency_15_to_20_pph",
    "55": "moderate_efficiency_15_to_20_pph",
    "56": "moderate_efficiency_15_to_20_pph",
    "57": "moderate_efficiency_15_to_20_pph",
    "59": "moderate_efficiency_15_to_20_pph",
    "60": "moderate_efficiency_15_to_20_pph",
    "69": "moderate_efficiency_15_to_20_pph",
    "74": "moderate_efficiency_15_to_20_pph",
    "77": "moderate_efficiency_15_to_20_pph",
    "81": "moderate_efficiency_15_to_20_pph",
    "87": "moderate_efficiency_15_to_20_pph",
    "88": "moderate_efficiency_15_to_20_pph",
    "91": "moderate_efficiency_15_to_20_pph",
    "G2": "moderate_efficiency_15_to_20_pph",
    "P68": "moderate_efficiency_15_to_20_pph",
    "P78": "moderate_efficiency_15_to_20_pph",
    "Y46": "moderate_efficiency_15_to_20_pph",
    "Y47": "moderate_efficiency_15_to_20_pph",
    "Y49": "moderate_efficiency_15_to_20_pph",
    "2": "low_efficiency_lt_15_pph",
    "4": "low_efficiency_lt_15_pph",
    "20": "low_efficiency_lt_15_pph",
    "36": "low_efficiency_lt_15_pph",
    "40": "low_efficiency_lt_15_pph",
    "53": "low_efficiency_lt_15_pph",
    "58": "low_efficiency_lt_15_pph",
    "65": "low_efficiency_lt_15_pph",
    "89": "low_efficiency_lt_15_pph",
    "7": "very_low_efficiency_lt_100_weekday_riders",
    "18": "very_low_efficiency_lt_100_weekday_riders",
    "71": "very_low_efficiency_lt_100_weekday_riders",
}

RAIL_EFFICIENCY: dict[str, str] = {
    "MI": "high_efficiency_gt_20_pph_unique_portions",
    "RED": "high_efficiency_gt_20_pph_unique_portions",
    "BLUE": "high_efficiency_gt_20_pph_unique_portions",
    "BLLB": "high_efficiency_gt_20_pph_unique_portions",
    "BLSV": "high_efficiency_gt_20_pph_unique_portions",
    "SLVR": "low_efficiency_lt_15_pph_unique_portions",
}

ROUTE_KIND: dict[str, str] = {}

for r in COMMUTER_EFFICIENCY:
    ROUTE_KIND[r] = "commuter_bus"
for r in NON_COMMUTER_EFFICIENCY:
    ROUTE_KIND[r] = "non_commuter_bus"
for r in RAIL_EFFICIENCY:
    ROUTE_KIND[r] = "light_rail_or_incline"

# Reduction steps (memo order). step 4 applies systemwide (11 PM end); listed per route where relevant.
# step: (action, detail)
REDUCTION: dict[str, list[tuple[int, str, str]]] = {}

def add_step(route: str, step: int, action: str, detail: str) -> None:
    REDUCTION.setdefault(route, []).append((step, action, detail))


# Step 1 — eliminate very low local & commuter <100 riders/day
for r in ["7", "18", "71", "O5", "P13", "Y45"]:
    add_step(r, 1, "eliminate", "Very low efficiency (<100 weekday riders); step 1")

# Step 2 — duplication elimination
for r in ["65", "19L", "G31", "P67", "P71", "Y1"]:
    add_step(r, 2, "eliminate", "Substantial service duplication/overlap; step 2")

# Step 3 — shorten to busway/rail feeders
add_step("28X", 3, "shorten", "PIT–Carnegie West Busway only")
add_step("44", 3, "shorten", "Kohne/Fisher–South Hills Junction only")
add_step("69", 3, "shorten", "Wilmerding–Wilkinsburg East Busway only")
add_step("RED", 3, "shorten", "Overbrook Junction–Allegheny only")

# Step 4 — systemwide night end (applies to entire network per memo)
NIGHT_DETAIL = "End all bus, light rail, and incline service at 11:00 p.m. daily; step 4"

# Step 5 — eliminate low-efficiency commuter + most low-efficiency local (15 & 89 retained equity)
for r in ["52L", "G3", "O1", "P10", "P12", "P16", "P7", "P76", "2", "4", "20", "36", "40", "58", "SLVR"]:
    add_step(r, 5, "eliminate", "Low efficiency commuter/local; step 5 (Silver Line = SLVR)")

# 15 & 89: low efficiency but explicitly retained in step 5 for equity (not eliminated); 15 also in step 6 frequency list.

# Step 6 — ≥30% weekly service frequency reduction on listed moderate routes
for r in [
    "1",
    "6",
    "8",
    "11",
    "12",
    "13",
    "15",
    "16",
    "17",
    "21",
    "22",
    "24",
    "27",
    "28X",
    "31",
    "44",
    "54",
    "56",
    "64",
    "69",
    "74",
    "75",
    "77",
    "79",
    "81",
    "82",
    "87",
    "88",
    "91",
    "G2",
    "P68",
    "P78",
    "Y46",
]:
    add_step(r, 6, "frequency_reduction_30pct_plus", "Major frequency reduction; step 6")

# Step 7 — eliminate remaining high-efficiency commuter (rush-hour cost burden)
for r in ["51L", "O12", "P17", "P69"]:
    add_step(r, 7, "eliminate", "Remaining commuter routes; step 7")

# Step 8 — eliminate selected moderate routes (equity/coverage exceptions per memo)
for r in ["14", "26", "29", "38", "39", "41", "43", "53L", "Y47", "Y49"]:
    add_step(r, 8, "eliminate", "Moderate efficiency local; step 8")


def combine_actions(route: str) -> str:
    steps = list(REDUCTION.get(route, []))
    steps.append((4, "end_service_11pm", NIGHT_DETAIL))
    parts = []
    for s, action, _ in sorted(steps, key=lambda x: x[0]):
        parts.append(f"step{s}:{action}")
    return ";".join(parts)


def primary_reduction(route: str) -> tuple[int, str, str]:
    """Earliest memo step affecting this route; step 4 applies systemwide if no earlier route-specific step."""
    steps = list(REDUCTION.get(route, []))
    if not steps:
        return 4, "end_service_11pm", NIGHT_DETAIL
    steps.sort(key=lambda x: x[0])
    s, action, detail = steps[0]
    return s, action, detail


def main() -> None:
    rows: list[dict[str, str]] = []

    all_routes = sorted(
        set(COMMUTER_EFFICIENCY) | set(NON_COMMUTER_EFFICIENCY) | set(RAIL_EFFICIENCY),
        key=lambda x: (not x[0].isdigit(), x),
    )

    for route in all_routes:
        kind = ROUTE_KIND[route]
        if kind == "commuter_bus":
            eff = COMMUTER_EFFICIENCY[route]
        elif kind == "non_commuter_bus":
            eff = NON_COMMUTER_EFFICIENCY[route]
        else:
            eff = RAIL_EFFICIENCY[route]

        st, action, detail = primary_reduction(route)
        code = RIDERSHIP_CODE.get(route, route)

        # Alignment: local 69 vs commuter P69 (distinct in monthly_avg_ridership.route)
        align_note = ""
        if route == "69":
            align_note = "local_69_not_P69; join ridership_route_code 069"
        elif route == "P69":
            align_note = "commuter_P69_not_069; join ridership_route_code P69"

        equity_step5 = ""
        if route in ("15", "89"):
            equity_step5 = "low_efficiency_retained_for_equity_in_step_5_not_eliminated"

        rows.append(
            {
                "route": route,
                "ridership_route_code": code,
                "route_kind": kind,
                "official_efficiency_tier": eff,
                "alignment_note": align_note,
                "memo_equity_exception_step5": equity_step5,
                "primary_reduction_step": str(st) if st is not None else "",
                "primary_reduction_action": action,
                "primary_reduction_detail": detail,
                "all_reduction_actions_in_order": combine_actions(route),
                "systemwide_step_4_night_end": "yes",
                "source_document": SOURCE,
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUT}")


if __name__ == "__main__":
    main()
