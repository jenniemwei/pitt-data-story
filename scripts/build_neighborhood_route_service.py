#!/usr/bin/env python3
# -----------------------------------------------------------------------------
# Stop-based neighborhood → route service (not inferred from route line shapes).
#
# Method: (1) For each stop×route in route_stop_per_route.csv, use stop_lat/lon
#    with neighborhoods.geojson: point in polygon (with holes) or within
#    WALKING_BUFFER m of the neighborhood boundary. (2) Classify using weekday
#    trip counts (trips_wd) and IB/OB direction. (3) This repo has no
#    stop_times.txt; the stop×route table is the join target used here in place
#    of a raw stops→stop_times→trips chain.
# Run: python3 scripts/build_neighborhood_route_service.py
# -----------------------------------------------------------------------------

from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ROUTE_STOPS = DATA / "route_stop_per_route.csv"
NEIGHBOR_GEO = DATA / "neighborhoods.geojson"
OUT_JSON = DATA / "neighborhood_route_service.json"

WALKING_BUFFER_M = 400.0
MIN_TRIPS_WEEKDAY = 4
AS_OF = date(2026, 2, 22)

PITTS_MUNI = "Pittsburgh city (Allegheny, PA)"


def _close_ring(r: list[list[float]]) -> list[list[float]]:
    if not r:
        return r
    if r[0] != r[-1]:
        return r + [r[0]]
    return r


def _point_in_ring(lon: float, lat: float, ring: list[list[float]]) -> bool:
    """Ray casting on one closed ring."""
    ring = _close_ring(ring)
    n = len(ring) - 1
    if n < 2:
        return False
    inside = False
    for i in range(n):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        intersects = (y0 > lat) != (y1 > lat) and lon < (x1 - x0) * (lat - y0) / (y1 - y0 + 1e-30) + x0
        if intersects:
            inside = not inside
    return inside


def _point_in_polygon_rings(
    lon: float, lat: float, poly_rings: list[list[list[float]]]
) -> bool:
    """First ring exterior; further rings are holes (GeoJSON Polygon)."""
    if not poly_rings:
        return False
    exterior, *holes = poly_rings
    ex = _close_ring(exterior)
    if not _point_in_ring(lon, lat, ex):
        return False
    for h in holes:
        hr = _close_ring(h)
        if _point_in_ring(lon, lat, hr):
            return False
    return True


def _point_to_segment_m(lon: float, lat: float, x0: float, y0: float, x1: float, y1: float) -> float:
    c = math.cos(math.radians(lat))
    ax, ay = 0.0, 0.0
    bx = (x1 - x0) * c * 111_320.0
    by = (y1 - y0) * 110_540.0
    px = (lon - x0) * c * 111_320.0
    py = (lat - y0) * 110_540.0
    t = max(0.0, min(1.0, (px * bx + py * by) / (bx * bx + by * by + 1e-20)))
    qx, qy = t * bx, t * by
    return float(math.hypot(px - qx, py - qy))


def _min_dist_to_ring_m(lon: float, lat: float, ring: list[list[float]]) -> float:
    ring = _close_ring(ring)
    m = float("inf")
    for i in range(len(ring) - 1):
        x0, y0 = ring[i][0], ring[i][1]
        x1, y1 = ring[i + 1][0], ring[i + 1][1]
        m = min(m, _point_to_segment_m(lon, lat, x0, y0, x1, y1))
    return m


def _min_dist_to_polygon_boundary_m(lon: float, lat: float, poly_rings: list[list[list[float]]]) -> float:
    m = float("inf")
    for ring in poly_rings:
        m = min(m, _min_dist_to_ring_m(lon, lat, ring))
    return m


def _min_dist_multipolygon_m(lon: float, lat: float, multipoly: list) -> float:
    m = float("inf")
    for poly in multipoly:
        m = min(m, _min_dist_to_polygon_boundary_m(lon, lat, poly))
    return m


def _stop_in_polygonish(lon: float, lat: float, gtype: str, coordinates: Any) -> bool:
    if gtype == "Polygon":
        if _point_in_polygon_rings(lon, lat, coordinates):
            return True
        d = _min_dist_to_polygon_boundary_m(lon, lat, coordinates)
        return d <= WALKING_BUFFER_M
    if gtype == "MultiPolygon":
        for poly in coordinates:
            if _point_in_polygon_rings(lon, lat, poly):
                return True
        d = _min_dist_multipolygon_m(lon, lat, coordinates)
        return d <= WALKING_BUFFER_M
    return False


def route_to_fy26(raw: str) -> str:
    s = (raw or "").strip().upper()
    if not s:
        return ""
    m = re.match(r"^(\d+)(.*)$", s)
    if m:
        return m.group(1).zfill(3) + m.group(2)
    return s


def stop_is_busway_platform(stop_name: str) -> bool:
    return "BUSWAY" in (stop_name or "").upper()


def is_employees_only_stop(stop_name: str) -> bool:
    """PRT employees-only / restricted stops — exclude from service-area coverage (not public)."""
    name = (stop_name or "").upper()
    return "EMPLOYEES ONLY" in name or "EMPLOYEE PARKING LOT" in name


def is_boundary_edge_only_stop(stop_name: str) -> bool:
    """
    Stops that sit on neighborhood boundary edges and should not, by themselves,
    make a route count as serving a neighborhood.
    """
    name = (stop_name or "").upper()
    return (
        "FIFTH AVE RAMP" in name
        or "FIFTH AVE OPP MCPHERSON" in name
        or "PENN AVE AT BAKERY SQUARE" in name
    )


def _parse_one_date(s: str) -> date | None:
    s = (s or "").strip()
    if not s:
        return None
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%m/%d/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def row_is_active_on(row: dict[str, str], as_of: date) -> bool:
    d0 = _parse_one_date(row.get("start_date") or "")
    d1 = _parse_one_date(row.get("end_date") or "")
    if d0 and as_of < d0:
        return False
    if d1 and as_of > d1:
        return False
    return True


@dataclass
class RouteAgg:
    stop_ids: set[str] = field(default_factory=set)
    has_ib: bool = False
    has_ob: bool = False
    max_trips_wd: int = 0
    has_meaningful_stop: bool = False

    def add(
        self, stop_id: str, direction: str, trips_wd: int, *, meaningful_for_route_count: bool
    ) -> None:
        if stop_id:
            self.stop_ids.add(stop_id)
        d = (direction or "").strip().upper()
        if d == "IB":
            self.has_ib = True
        elif d == "OB":
            self.has_ob = True
        if trips_wd > self.max_trips_wd:
            self.max_trips_wd = trips_wd
        if meaningful_for_route_count:
            self.has_meaningful_stop = True


def load_neighborhood_geoms(geojson_path: Path) -> list[tuple[str, str, Any]]:
    with geojson_path.open(encoding="utf-8") as f:
        fc = json.load(f)
    out: list[tuple[str, str, Any]] = []
    for feat in fc.get("features", []):
        p = feat.get("properties") or {}
        hood = (p.get("hood") or "").strip()
        g = feat.get("geometry") or {}
        gtype, coords = g.get("type"), g.get("coordinates")
        if not hood or gtype not in ("Polygon", "MultiPolygon") or not coords:
            continue
        out.append((hood, gtype, coords))
    return out


def build_stop_to_hoods(
    geoms: list[tuple[str, str, Any]], lon: float, lat: float
) -> list[str]:
    names: list[str] = []
    for hood, gtype, coords in geoms:
        if _stop_in_polygonish(lon, lat, gtype, coords):
            names.append(hood)
    return names


def build_stop_to_hoods_interior_only(
    geoms: list[tuple[str, str, Any]], lon: float, lat: float
) -> set[str]:
    """Neighborhoods that strictly contain the stop point (no boundary buffer)."""
    names: set[str] = set()
    for hood, gtype, coords in geoms:
        if gtype == "Polygon":
            if _point_in_polygon_rings(lon, lat, coords):
                names.add(hood)
        elif gtype == "MultiPolygon":
            for poly in coords:
                if _point_in_polygon_rings(lon, lat, poly):
                    names.add(hood)
                    break
    return names


def compute_directions_served(agg: RouteAgg) -> int | str:
    if agg.has_ib and agg.has_ob:
        return "both"
    if agg.has_ib and not agg.has_ob:
        return 0
    if agg.has_ob and not agg.has_ib:
        return 1
    return "both"


def compute_service_level(agg: RouteAgg) -> str:
    if not agg.has_ib and not agg.has_ob:
        if agg.max_trips_wd < MIN_TRIPS_WEEKDAY:
            return "minimal"
        return "full"
    if not (agg.has_ib and agg.has_ob):
        return "partial"
    if agg.max_trips_wd < MIN_TRIPS_WEEKDAY:
        return "minimal"
    return "full"


def load_routes_fy26_names() -> dict[str, str]:
    p = DATA / "GTFS" / "routes.txt"
    by_id: dict[str, str] = {}
    with p.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = (row.get("route_id") or "").strip()
            short = (row.get("route_short_name") or row.get("route_id") or "").strip()
            if rid:
                by_id[route_to_fy26(rid)] = short
    return by_id


def run(*, pittsburgh_muni_only: bool = True) -> dict[str, Any]:
    geoms = load_neighborhood_geoms(NEIGHBOR_GEO)
    route_names = load_routes_fy26_names()
    cell: dict[tuple[str, str], RouteAgg] = {}
    with ROUTE_STOPS.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            stop_name = row.get("stop_name") or ""
            if is_employees_only_stop(stop_name):
                continue
            if pittsburgh_muni_only and (row.get("muni") or "").strip() != PITTS_MUNI:
                continue
            if not row_is_active_on(row, AS_OF):
                continue
            try:
                lat = float((row.get("stop_lat") or "0").strip() or 0)
                lon = float((row.get("stop_lon") or "0").strip() or 0)
            except ValueError:
                continue
            route_raw = (row.get("route_id") or "").strip()
            rkey = route_to_fy26(route_raw)
            if not rkey:
                continue
            try:
                tw = int(float((row.get("trips_wd") or "0").strip() or 0))
            except ValueError:
                tw = 0
            sid = (row.get("stop_id") or "").strip()
            direction = (row.get("direction") or "").strip()
            interior_hoods = build_stop_to_hoods_interior_only(geoms, lon, lat)
            for hood in build_stop_to_hoods(geoms, lon, lat):
                k = (hood, rkey)
                a = cell.setdefault(k, RouteAgg())
                meaningful_for_route_count = (
                    hood in interior_hoods and not is_boundary_edge_only_stop(stop_name)
                )
                a.add(
                    sid,
                    direction,
                    tw,
                    meaningful_for_route_count=meaningful_for_route_count,
                )

    by_hood: dict[str, list[dict[str, Any]]] = {}
    for (hood, rkey), agg in cell.items():
        # A route only counts for a neighborhood if it has at least one
        # non-boundary-edge stop there.
        if not agg.has_meaningful_stop:
            continue
        dsv = compute_directions_served(agg)
        sl = compute_service_level(agg)
        rname = route_names.get(rkey, rkey)
        item = {
            "route_id": rkey,
            "route_short_name": rname,
            "stops_in_neighborhood": sorted(agg.stop_ids),
            "daily_trips": agg.max_trips_wd,
            "directions_served": dsv,
            "service_level": sl,
        }
        by_hood.setdefault(hood, []).append(item)

    for hood in by_hood:
        by_hood[hood].sort(key=lambda r: (r["route_id"]))

    meta = {
        "method": (
            "Stop-based only: each stop×route (active table date window) is tested against "
            "neighborhood GeoJSON (interior or within buffer of boundary). "
            "Route line shapes are not used. "
            "No bundled stop_times.txt; grain matches stops→stop_times→trips using route_stop_per_route.csv. "
            "Rows where stop_name contains 'EMPLOYEES ONLY' or 'EMPLOYEE PARKING LOT' (any case) are excluded. "
            "A route counts for a neighborhood only if it has at least one stop in that neighborhood whose stop_name "
            "does not contain 'FIFTH AVE RAMP', 'FIFTH AVE OPP MCPHERSON', or 'PENN AVE AT BAKERY SQUARE'. "
            "When that condition is met, all of the route's stops in the neighborhood are retained for service metrics."
        ),
        "walking_buffer_m": WALKING_BUFFER_M,
        "min_trips_per_weekday": MIN_TRIPS_WEEKDAY,
        "as_of_date": AS_OF.isoformat(),
        "sources": [
            "data/route_stop_per_route.csv",
            "data/neighborhoods.geojson",
            "data/GTFS/routes.txt (labels)",
        ],
    }
    return {
        "meta": meta,
        "neighborhoods": [
            {"neighborhood": h, "routes": by_hood[h]} for h in sorted(by_hood, key=str.lower)
        ],
    }


def get_fy26_hood_route_sets() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """(all_routes_by_hood, street_routes_by_hood) for extend_fy26_map_neighborhoods."""
    geoms = load_neighborhood_geoms(NEIGHBOR_GEO)
    qualifier_all: dict[tuple[str, str], bool] = {}
    qualifier_street: dict[tuple[str, str], bool] = {}
    all_h: dict[str, set[str]] = {}
    street_h: dict[str, set[str]] = {}
    with ROUTE_STOPS.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row.get("stop_name") or ""
            if is_employees_only_stop(name):
                continue
            if (row.get("muni") or "").strip() != PITTS_MUNI:
                continue
            if not row_is_active_on(row, AS_OF):
                continue
            try:
                lat = float((row.get("stop_lat") or "0").strip() or 0)
                lon = float((row.get("stop_lon") or "0").strip() or 0)
            except ValueError:
                continue
            route_raw = (row.get("route_id") or "").strip()
            rkey = route_to_fy26(route_raw)
            if not rkey:
                continue
            interior_hoods = build_stop_to_hoods_interior_only(geoms, lon, lat)
            for hood in build_stop_to_hoods(geoms, lon, lat):
                hk = (hood, rkey)
                meaningful = hood in interior_hoods and not is_boundary_edge_only_stop(name)
                if meaningful:
                    qualifier_all[hk] = True
                    if not stop_is_busway_platform(name):
                        qualifier_street[hk] = True

    for hood, rkey in qualifier_all:
        all_h.setdefault(hood, set()).add(rkey)
    for hood, rkey in qualifier_street:
        street_h.setdefault(hood, set()).add(rkey)
    return all_h, street_h


if __name__ == "__main__":
    payload = run()
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    n = len(payload["neighborhoods"])
    print(f"Wrote {n} neighborhood records to {OUT_JSON}")
