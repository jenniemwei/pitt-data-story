"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import RadialNetwork from "../RadialNetwork";
import { dataAssetUrl } from "../../lib/dataAssetUrl";
import styles from "./RouteWeb.module.css";

const STATUS_CSV = "route_status_official.csv";
const PROFILE_CSV = "display_profiles_2024.csv";

const BASE_NEIGHBORHOODS = [
  { name: "Downtown", bearing: 0, ring: 0, poverty: 0.23, pop: 7354, routes: ["P1"] },
  { name: "Oakland", bearing: 110, ring: 1, poverty: 0.46, pop: 18660, routes: ["71A", "71B", "71C"] },
  { name: "East Liberty", bearing: 70, ring: 1, poverty: 0.13, pop: 6013, routes: ["71C", "86", "P1"] },
  { name: "Shadyside", bearing: 90, ring: 1, poverty: 0.19, pop: 14215, routes: ["61A", "61B"] },
  { name: "Larimer", bearing: 55, ring: 2, poverty: 0.41, pop: 1574, routes: ["74", "86"] },
  { name: "Homewood South", bearing: 45, ring: 2, poverty: 0.36, pop: 2177, routes: ["77", "82"] },
  { name: "Homewood North", bearing: 35, ring: 2, poverty: 0.32, pop: 1800, routes: ["77"] },
  { name: "Lincoln-Lemington", bearing: 30, ring: 3, poverty: 0.33, pop: 4485, routes: ["82"] },
  { name: "East Hills", bearing: 20, ring: 3, poverty: 0.49, pop: 3505, routes: ["77"] },
  { name: "Hazelwood", bearing: 140, ring: 2, poverty: 0.32, pop: 4200, routes: ["56"] },
  { name: "Squirrel Hill", bearing: 100, ring: 2, poverty: 0.16, pop: 15071, routes: ["61C", "61D"] },
  { name: "Bloomfield", bearing: 80, ring: 1, poverty: 0.11, pop: 8916, routes: ["54"] },
  { name: "Lawrenceville", bearing: 60, ring: 1, poverty: 0.13, pop: 7715, routes: ["54"] },
  { name: "North Side", bearing: 300, ring: 1, poverty: 0.26, pop: 1924, routes: ["16", "11"] },
  { name: "Brighton Heights", bearing: 320, ring: 2, poverty: 0.09, pop: 7047, routes: ["16"] },
  { name: "Perry South", bearing: 340, ring: 2, poverty: 0.21, pop: 4045, routes: ["11"] },
  { name: "Beechview", bearing: 220, ring: 2, poverty: 0.09, pop: 7647, routes: ["39", "44"] },
  { name: "Mt Washington", bearing: 200, ring: 1, poverty: 0.12, pop: 8596, routes: ["40", "39"] },
  { name: "South Side Flats", bearing: 170, ring: 1, poverty: 0.24, pop: 7185, routes: ["51"] },
  { name: "Bedford Dwellings", bearing: 180, ring: 1, poverty: 0.52, pop: 1380, routes: ["83", "82"] },
  { name: "Middle Hill", bearing: 270, ring: 1, poverty: 0.39, pop: 1561, routes: ["83", "82"] },
  { name: "Knoxville", bearing: 210, ring: 2, poverty: 0.22, pop: 4188, routes: ["44", "51"] },
];

function parseCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    const fatal = parsed.errors.find(
      (e) => e.type !== "Quotes" && e.type !== "FieldMismatch",
    );
    if (fatal) throw new Error(fatal.message);
    // route_status_official.csv contains a few malformed trailing quotes;
    // keep parsed rows and continue for resilience.
    console.warn("RouteWeb CSV parse warning:", parsed.errors[0].message);
  }
  return parsed.data;
}

function bucketToHeadway(raw) {
  const text = String(raw || "").toLowerCase();
  if (text.includes("<20")) return 10;
  if (text.includes("21-40")) return 30;
  if (text.includes("41-60")) return 60;
  if (text.includes("61+")) return 80;
  return 30;
}

function normalizeRouteId(id) {
  const raw = String(id || "").toUpperCase().trim();
  const m = raw.match(/^(\d+)([A-Z].*)?$/);
  if (!m) return raw;
  return `${Number(m[1])}${m[2] || ""}`;
}

function normalizeName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function aggregate(rows) {
  if (!rows.length) return null;
  const pop = rows.reduce((sum, r) => sum + Number(r.total_pop || 0), 0);
  if (!pop) return null;
  const poverty = rows.reduce((sum, r) => sum + Number(r.total_pop || 0) * Number(r.share_below_100pct_poverty_threshold || 0), 0) / pop;
  return { pop: Math.round(pop), poverty };
}

function buildNeighborhoodLookup(profileRows) {
  const byName = new Map();
  for (const row of profileRows) {
    const key = normalizeName(row.neighborhood_group);
    byName.set(key, row);
  }

  const get = (name) => {
    const key = normalizeName(name);
    if (byName.has(key)) {
      const row = byName.get(key);
      return {
        pop: Number(row.total_pop || 0),
        poverty: Number(row.share_below_100pct_poverty_threshold || 0),
      };
    }

    // Dataset-driven group fallbacks when prompt names are aggregates.
    if (key === "oakland") {
      const rows = profileRows.filter((r) => ["north oakland", "central oakland", "south oakland"].includes(normalizeName(r.neighborhood_group)));
      return aggregate(rows);
    }
    if (key === "lawrenceville") {
      const rows = profileRows.filter((r) => ["upper lawrenceville", "central lawrenceville", "lower lawrenceville"].includes(normalizeName(r.neighborhood_group)));
      return aggregate(rows);
    }
    if (key === "squirrel hill") {
      const rows = profileRows.filter((r) => ["squirrel hill north", "squirrel hill south"].includes(normalizeName(r.neighborhood_group)));
      return aggregate(rows);
    }
    if (key === "north side") {
      const rows = profileRows.filter((r) => normalizeName(r.profile_neighborhood_group) === "east allegheny-north shore");
      return aggregate(rows);
    }
    if (key === "lincoln-lemington") {
      const row = byName.get("lincoln-lemington-belmar");
      if (!row) return null;
      return {
        pop: Number(row.total_pop || 0),
        poverty: Number(row.share_below_100pct_poverty_threshold || 0),
      };
    }
    if (key === "mt washington") {
      const row = byName.get("mount washington");
      if (!row) return null;
      return {
        pop: Number(row.total_pop || 0),
        poverty: Number(row.share_below_100pct_poverty_threshold || 0),
      };
    }

    return null;
  };

  return { get };
}

function toStatusRows(statusRows) {
  const byRoute = new Map();
  for (const row of statusRows) {
    const id = normalizeRouteId(row["#"] || row.Sort || row["Route name:"]);
    if (!id) continue;
    byRoute.set(id, row);
  }
  return byRoute;
}

function createNeighborhoods(statusRows, profileRows) {
  const statusByRoute = toStatusRows(statusRows);
  const lookup = buildNeighborhoodLookup(profileRows);

  return BASE_NEIGHBORHOODS.map((base) => {
    const data = lookup.get(base.name);

    const routes = base.routes.map((rid) => {
      const row = statusByRoute.get(normalizeRouteId(rid));
      if (!row) {
        return {
          id: rid,
          label: `Route ${rid}`,
          beforeHeadway: 30,
          afterHeadway: 30,
        };
      }

      const typeChange = String(row["Type of change:"] || "").toLowerCase();
      const eliminated = typeChange.includes("eliminated");

      return {
        id: rid,
        label: `Route ${rid}`,
        beforeHeadway: bucketToHeadway(row["Frequency current"]),
        afterHeadway: eliminated ? 999 : bucketToHeadway(row["Frequency proposed"]),
      };
    });

    return {
      name: base.name,
      bearing: base.bearing,
      ring: base.ring,
      poverty: data?.poverty ?? base.poverty,
      pop: data?.pop ?? base.pop,
      routes,
    };
  });
}

export default function NeighborhoodRepresentationalRoutesMap() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(dataAssetUrl(STATUS_CSV)).then((r) => r.text()),
      fetch(dataAssetUrl(PROFILE_CSV)).then((r) => r.text()),
    ])
      .then(([statusRaw, profileRaw]) => {
        if (cancelled) return;
        const statusRows = parseCsv(statusRaw);
        const profileRows = parseCsv(profileRaw);
        setNeighborhoods(createNeighborhoods(statusRows, profileRows));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (!selected) return "Click a neighborhood to inspect route losses.";
    return `${selected.name}: ${selected.routes.length} route${selected.routes.length === 1 ? "" : "s"} tracked`;
  }, [selected]);

  return (
    <section className={styles.section} aria-label="Radial neighborhood transit network">
      <div className={styles.inner}>
        <h2 className={styles.title}>Neighborhood transit equity network</h2>
        <p className={styles.lede}>
          Downtown is centered; neighborhoods radiate by geographic bearing and ring distance.
          Circle size maps population. Color/opacity map poverty rate. Click to inspect before/after route changes.
        </p>
        <p className={styles.lede}>{subtitle}</p>
        {error ? <p className={styles.tokenMissing}>{error}</p> : null}
      </div>
      <div className={styles.mapWrap}>
        {neighborhoods.length ? (
          <RadialNetwork neighborhoods={neighborhoods} onSelect={setSelected} />
        ) : (
          <div className={styles.tokenMissing}>Loading neighborhood network...</div>
        )}
      </div>
    </section>
  );
}
