#!/usr/bin/env python3
"""Consolidated data pipeline runner.

This orchestrates the existing project data-build scripts in a single entrypoint.
It does not alter SOURCE files and preserves current OUTPUT formats.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_cmd(cmd: list[str]) -> None:
    print(f"$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=ROOT, check=True)


def main() -> None:
    # --- STEP 1: normalize stop/geography tables ---
    overrides = ROOT / "data" / "neighborhood_hood_crosswalk_overrides.csv"
    if overrides.exists():
        run_cmd(["python3", "scripts/normalize_geography_step1.py"])
    else:
        print("skip STEP 1 (normalize_geography_step1.py): missing data/neighborhood_hood_crosswalk_overrides.csv")

    # --- STEP 2: build stop-based neighborhood route service ---
    run_cmd(["python3", "scripts/build_neighborhood_route_service.py"])

    # --- STEP 3: extend FY26 neighborhood route coverage + refresh anchors ---
    run_cmd(["python3", "scripts/extend_fy26_map_neighborhoods.py"])
    run_cmd(["python3", "scripts/refresh_fy26_status_anchors.py"])

    # --- STEP 4: generate route findings (cuts built in-memory) ---
    run_cmd(["python3", "scripts/generate_fy2026_eliminated_route_findings.py"])

    # --- STEP 5: build route-level demographics outputs ---
    run_cmd(["python3", "scripts/build_routes_with_demographics.py"])

    # --- STEP 6: build corridor-story routes ---
    run_cmd(["node", "scripts/build-corridor-story-routes.mjs"])

    # --- STEP 7: sync app-served public data assets ---
    run_cmd(["node", "scripts/sync-public-data.mjs"])

    print("Pipeline complete.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as exc:
        print(f"Pipeline failed at command: {exc.cmd}", file=sys.stderr)
        raise SystemExit(exc.returncode)
