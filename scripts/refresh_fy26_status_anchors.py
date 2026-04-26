#!/usr/bin/env python3
"""Recompute `anchor_neighborhoods` and `anchor_rationale` in FY26_route_status_all.csv from
`data/neighborhood_route_service.json` (stop/polygon + buffer; not route shapes)."""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NRS = ROOT / "data" / "neighborhood_route_service.json"
FY26 = ROOT / "data" / "FY26_route_status_all.csv"

ANCHOR = (
    "Stops in/near neighborhood boundary vs GeoJSON; see `neighborhood_route_service.json` "
    "(not inferred from route line geometry)."
)


def route_to_anchors() -> dict[str, str]:
    with NRS.open(encoding="utf-8") as f:
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
            n_st = len(r.get("stops_in_neighborhood") or [])
            by_route.setdefault(rid, []).append((n, trips, n_st))
    out: dict[str, str] = {}
    for rid, pairs in by_route.items():
        pairs.sort(key=lambda x: (-x[1], -x[2], x[0].lower()))
        out[rid] = ", ".join(t[0] for t in pairs) if pairs else ""
    return out


def main() -> None:
    if not NRS.is_file() or not FY26.is_file():
        print("Missing data files", file=sys.stderr)
        raise SystemExit(1)
    anchors = route_to_anchors()
    with FY26.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    fieldnames = list(rows[0].keys()) if rows else []
    for row in rows:
        code = (row.get("route_code") or "").strip()
        row["anchor_neighborhoods"] = anchors.get(code, "None (see geography note)")
        row["anchor_rationale"] = ANCHOR
    with FY26.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"Updated {len(rows)} rows in {FY26}.")


if __name__ == "__main__":
    main()
