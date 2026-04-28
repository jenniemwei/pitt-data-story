"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { bearing, centroid, distance, point } from "@turf/turf";
import CoverageMap from "../coverage-map/CoverageMap";
import { dataAssetUrl } from "../../lib/dataAssetUrl";
import { mergeDisplayAndNProfiles, normalizeStatus, parseRouteList } from "../../lib/neighborhoodPanelPayload";
import RadialNetworkMap from "./RadialNetworkMap";
import styles from "./ExploreDashboard.module.css";

function parseCsv(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function pct(v) {
  return `${(num(v) * 100).toFixed(1)}%`;
}

function buildProfileMembers(displayRows) {
  const m = new Map();
  for (const row of displayRows) {
    const group = String(row.profile_neighborhood_group || row.neighborhood_group || "").trim();
    const hood = String(row.neighborhood_group || "").trim();
    if (!group || !hood) continue;
    if (!m.has(group)) m.set(group, new Set());
    m.get(group).add(hood);
  }
  return m;
}

function NeighborhoodDetailCard({ detail }) {
  const profile = detail.profile || {};
  return (
    <article className={styles.card}>
      <h3 className={`${styles.cardTitle} type-h3 text-ink-default`}>{detail.neighborhood}</h3>
      <div className={styles.metricGrid}>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Poverty rate</span>
          <span className="type-data-value text-ink-default">{pct(profile.share_below_100pct_poverty_threshold)}</span>
        </div>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Transit commuters</span>
          <span className="type-data-value text-ink-default">{pct(profile.share_commute_public_transit)}</span>
        </div>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Car-free households</span>
          <span className="type-data-value text-ink-default">{pct(1 - num(profile.share_commute_car_truck_van))}</span>
        </div>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Population</span>
          <span className="type-data-value text-ink-default">{Math.round(num(profile.total_pop)).toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Stops before</span>
          <span className="type-data-value text-ink-default">{detail.stopCountBefore.toLocaleString("en-US")}</span>
        </div>
        <div>
          <span className={`${styles.metricLabel} type-data-label text-ink-secondary`}>Stops after</span>
          <span className="type-data-value text-ink-default">{detail.stopCountAfter.toLocaleString("en-US")}</span>
        </div>
      </div>

      <div className={styles.routeBlock}>
        <p className="type-data-label text-ink-secondary">Routes before FY26</p>
        <p className={`${styles.routeList} type-data-route-label text-ink-default`}>
          {detail.beforeRoutes.length
            ? detail.beforeRoutes.map((id) => `${id} (${Math.round(num(detail.ridershipByRoute.get(id)?.baseline, 0)).toLocaleString("en-US")})`).join(", ")
            : "—"}
        </p>
      </div>
      <div className={styles.routeBlock}>
        <p className="type-data-label text-ink-secondary">Routes after FY26</p>
        <p className={`${styles.routeList} type-data-route-label text-ink-default`}>
          {detail.beforeRoutes.length
            ? detail.beforeRoutes.map((id, i) => {
                const s = detail.statusByRoute.get(id) || "unchanged";
                const cls = s === "eliminated" ? styles.routeEliminated : s === "reduced" ? styles.routeReduced : "";
                const sep = i > 0 ? ", " : "";
                return (
                  <span key={id}>
                    {sep}
                    <span className={cls}>{id} ({s === "unchanged" ? "kept" : s})</span>
                  </span>
                );
              })
            : "—"}
        </p>
      </div>
    </article>
  );
}

export default function ExploreDashboard() {
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useState([]);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(dataAssetUrl("display_profiles_2024.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_status_official.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("fy26_route_n_profiles_all.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("route_stop_per_route.csv")).then((r) => r.text()),
      fetch(dataAssetUrl("neighborhoods.geojson")).then((r) => r.json()),
    ]).then(([displayRaw, statusRaw, nProfRaw, stopRaw, hoodGeo]) => {
      if (cancelled) return;
      setRows({
        displayRows: parseCsv(displayRaw),
        statusRows: parseCsv(statusRaw),
        nProfRows: parseCsv(nProfRaw),
        stopRows: parseCsv(stopRaw),
        hoodGeo,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const derived = useMemo(() => {
    if (!rows) return null;
    const { displayRows, statusRows, nProfRows, stopRows, hoodGeo } = rows;

    const profilesByHood = mergeDisplayAndNProfiles(displayRows);
    const profileMembers = buildProfileMembers(displayRows);

    const statusByRoute = new Map();
    const ridershipByRoute = new Map();
    for (const row of statusRows) {
      const routeId = String(row.route_code || row.route_label || "").trim();
      if (!routeId) continue;
      statusByRoute.set(routeId, normalizeStatus(row.route_status));
      ridershipByRoute.set(routeId, {
        baseline: num(row.weekday_avg_riders_baseline_2017_2019, 0),
        recent: num(row.weekday_avg_riders_recent_2023_2024, 0),
      });
    }

    const routesByNeighborhood = new Map();
    for (const row of nProfRows) {
      const hood = String(row.neighborhood || row.hood || "").trim();
      if (!hood) continue;
      if (!routesByNeighborhood.has(hood)) routesByNeighborhood.set(hood, new Set());
      for (const routeId of parseRouteList(row.routes_before)) routesByNeighborhood.get(hood).add(routeId);
    }

    const downtownFeature = (hoodGeo.features || []).find((f) => {
      const hood = String(f?.properties?.hood || "").trim();
      return hood === "Central Business District";
    });
    const downtownCentroid = downtownFeature ? centroid(downtownFeature).geometry.coordinates : [-79.9959, 40.4406];

    const radialNodes = [];
    for (const [k, profile] of profilesByHood.entries()) {
      const name = String(profile.profile_neighborhood_group || profile.neighborhood_group || "").trim();
      if (!name) continue;
      if (radialNodes.find((n) => n.name === name)) continue;
      const members = profileMembers.get(name) ? Array.from(profileMembers.get(name)) : [name];
      const memberSet = new Set(members);
      const feats = (hoodGeo.features || []).filter((f) => memberSet.has(String(f?.properties?.hood || "").trim()));
      const c = feats.length ? centroid({ type: "FeatureCollection", features: feats }).geometry.coordinates : downtownCentroid;
      radialNodes.push({
        name,
        isDowntown: name === "Central Business District",
        population: num(profile.total_pop, 0),
        povertyShare: num(profile.share_below_100pct_poverty_threshold, 0),
        bearingDeg: bearing(point(downtownCentroid), point(c)),
        distanceKm: distance(point(downtownCentroid), point(c), { units: "kilometers" }),
        routesBefore: Array.from(
          members.reduce((acc, hood) => {
            for (const r of routesByNeighborhood.get(hood) || []) acc.add(r);
            return acc;
          }, new Set()),
        ),
      });
    }

    const stopIdsByRouteByHood = new Map();
    for (const row of stopRows) {
      const hood = String(row.hood || "").trim();
      const routeId = String(row.route_id || row.route_filter || "").trim();
      const stopId = String(row.stop_id || "").trim();
      if (!hood || !routeId || !stopId) continue;
      if (!stopIdsByRouteByHood.has(hood)) stopIdsByRouteByHood.set(hood, new Map());
      const byRoute = stopIdsByRouteByHood.get(hood);
      if (!byRoute.has(routeId)) byRoute.set(routeId, new Set());
      byRoute.get(routeId).add(stopId);
    }

    return {
      profilesByHood,
      profileMembers,
      statusByRoute,
      ridershipByRoute,
      routesByNeighborhood,
      stopIdsByRouteByHood,
      radialNodes,
    };
  }, [rows]);

  const details = useMemo(() => {
    if (!derived) return [];
    return selectedNeighborhoods.map((name) => {
      const profile = derived.profilesByHood.get(String(name).trim().toLowerCase()) || null;
      const members = derived.profileMembers.get(name) ? Array.from(derived.profileMembers.get(name)) : [name];
      const beforeRoutes = Array.from(
        members.reduce((acc, hood) => {
          for (const r of derived.routesByNeighborhood.get(hood) || []) acc.add(r);
          return acc;
        }, new Set()),
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      const beforeStops = new Set();
      const afterStops = new Set();
      for (const hood of members) {
        const byRoute = derived.stopIdsByRouteByHood.get(hood);
        if (!byRoute) continue;
        for (const routeId of beforeRoutes) {
          const set = byRoute.get(routeId);
          if (!set) continue;
          for (const sid of set) {
            beforeStops.add(sid);
            const status = derived.statusByRoute.get(routeId) || "unchanged";
            if (status !== "eliminated") afterStops.add(sid);
          }
        }
      }

      return {
        neighborhood: name,
        profile,
        beforeRoutes,
        statusByRoute: derived.statusByRoute,
        ridershipByRoute: derived.ridershipByRoute,
        stopCountBefore: beforeStops.size,
        stopCountAfter: afterStops.size,
      };
    });
  }, [derived, selectedNeighborhoods]);

  const onToggleNeighborhood = (name, shiftKey) => {
    setSelectedNeighborhoods((prev) => {
      if (prev.includes(name)) return prev.filter((n) => n !== name);
      if (shiftKey) return [...prev, name].slice(-2);
      return [name];
    });
  };

  return (
    <section className={styles.wrap} aria-label="Explore transit equity dashboard">
      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2 className={`${styles.panelTitle} type-h2 text-ink-default`}>1) Neighborhood selector</h2>
          <p className={`${styles.panelSub} type-body-sm text-ink-secondary`}>
            Click to select. Shift-click for a second neighborhood comparison.
          </p>
        </header>
        <div className={styles.radialSlot}>
          <RadialNetworkMap
            nodes={derived?.radialNodes || []}
            selectedNeighborhoods={selectedNeighborhoods}
            onToggleNeighborhood={onToggleNeighborhood}
          />
        </div>
      </div>

      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2 className={`${styles.panelTitle} type-h2 text-ink-default`}>2) Coverage change</h2>
        </header>
        <div className={styles.coverageSlot}>
          <CoverageMap mode="explore" selectedNeighborhoods={selectedNeighborhoods} />
        </div>
      </div>

      <div className={styles.panel}>
        <header className={styles.panelHeader}>
          <h2 className={`${styles.panelTitle} type-h2 text-ink-default`}>3) Neighborhood detail</h2>
        </header>
        <div className={styles.detailsBody}>
          {details.length === 0 ? (
            <p className={`${styles.emptyState} type-body-m text-ink-secondary`}>
              Select a neighborhood above to see its transit profile.
            </p>
          ) : (
            <div className={styles.cards}>
              {details.map((d) => (
                <NeighborhoodDetailCard key={d.neighborhood} detail={d} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
