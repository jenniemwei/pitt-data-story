"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import styles from "./ConnectionVis.module.css";

const MAX_NEIGHBORHOODS = 16;
const SVG_W = 980;
const SVG_H = 640;
const CENTER_X = 520;
const CENTER_Y = 360;
const CENTER_R = 42;

const FALLBACK = [
  {
    neighborhood: "Crafton Heights",
    population_total: 3951,
    below_poverty_pct: 0.264996203,
    routes_before: "026;027;029;031",
    routes_losing: "026;029",
    reduced_routes: "027;031",
  },
  {
    neighborhood: "East Hills",
    population_total: 3505,
    below_poverty_pct: 0.486733238,
    routes_before: "071D;077;079;086;P17",
    routes_losing: "P17",
    reduced_routes: "071D;077;086",
  },
  {
    neighborhood: "Lincoln-Lemington-Belmar",
    population_total: 4485,
    below_poverty_pct: 0.326196777,
    routes_before: "001;074;075;079;082;091;P10;P17",
    routes_losing: "P10;P17",
    reduced_routes: "001;074;075;082;091",
  },
  {
    neighborhood: "Allentown",
    population_total: 1966,
    below_poverty_pct: 0.24923703,
    routes_before: "043;044;048;051L;054",
    routes_losing: "043;051L",
    reduced_routes: "044;048;054",
  },
  {
    neighborhood: "West End",
    population_total: 2712,
    below_poverty_pct: 0.180534918,
    routes_before: "026;027;029;031;038",
    routes_losing: "026;029;038",
    reduced_routes: "027;031",
  },
  {
    neighborhood: "Point Breeze North",
    population_total: 1884,
    below_poverty_pct: 0.06745182,
    routes_before: "028X;067;069;071C;071D;074;088;089",
    routes_losing: "",
    reduced_routes: "028X;067;069;071C;071D;074;088",
  },
];

function parseRouteList(raw) {
  return String(raw || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePct(value) {
  const n = toNum(value, 0);
  return n > 1 ? n / 100 : n;
}

function povertyClass(povertyRatio) {
  if (povertyRatio >= 0.3) return "r3";
  if (povertyRatio >= 0.2) return "r2";
  if (povertyRatio >= 0.1) return "n4";
  return "g1";
}

function loadRows(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
  return parsed
    .map((row) => {
      const routesBefore = parseRouteList(row.routes_before);
      if (!routesBefore.length) return null;
      const eliminated = new Set(parseRouteList(row.routes_losing));
      const reduced = new Set(parseRouteList(row.reduced_routes));
      return {
        name: String(row.neighborhood || "").trim(),
        population: toNum(row.population_total, 0),
        poverty: normalizePct(row.below_poverty_pct),
        routes: routesBefore.map((routeId) => ({
          routeId,
          status: eliminated.has(routeId) ? "eliminated" : reduced.has(routeId) ? "reduced" : "unchanged",
        })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.routes.length - a.routes.length)
    .slice(0, MAX_NEIGHBORHOODS);
}

function buildCurvedPath(sx, sy, tx, ty, bend) {
  const mx = (sx + tx) / 2;
  const my = (sy + ty) / 2;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
}

export default function ConnectionVis() {
  const [rows, setRows] = useState(
    FALLBACK.map((r) => ({
      name: r.neighborhood,
      population: r.population_total,
      poverty: normalizePct(r.below_poverty_pct),
      routes: parseRouteList(r.routes_before).map((routeId) => {
        const eliminated = new Set(parseRouteList(r.routes_losing));
        const reduced = new Set(parseRouteList(r.reduced_routes));
        return {
          routeId,
          status: eliminated.has(routeId) ? "eliminated" : reduced.has(routeId) ? "reduced" : "unchanged",
        };
      }),
    })),
  );
  const [afterCuts, setAfterCuts] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(dataAssetUrl("n_shortlist.csv"))
      .then((r) => {
        if (!r.ok) throw new Error("Missing n_shortlist.csv");
        return r.text();
      })
      .then((text) => {
        if (cancelled) return;
        const loaded = loadRows(text);
        if (loaded.length) setRows(loaded);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const nodes = useMemo(() => {
    if (!rows.length) return [];
    const minPop = Math.min(...rows.map((r) => r.population));
    const maxPop = Math.max(...rows.map((r) => r.population), minPop + 1);
    const count = rows.length;
    return rows.map((row, i) => {
      const t = count === 1 ? 0 : i / (count - 1);
      const angle = -Math.PI * 0.96 + t * Math.PI * 1.92;
      const rx = 390 + (i % 3) * 10;
      const ry = 255 + ((i + 1) % 4) * 9;
      const x = CENTER_X + Math.cos(angle) * rx;
      const y = CENTER_Y + Math.sin(angle) * ry;
      const popT = (row.population - minPop) / (maxPop - minPop);
      const r = 12 + Math.sqrt(Math.max(0, popT)) * 24;
      return {
        ...row,
        x,
        y,
        r,
        povertyBand: povertyClass(row.poverty),
      };
    });
  }, [rows]);

  const linePaths = useMemo(() => {
    const paths = [];
    for (const node of nodes) {
      node.routes.forEach((route, idx) => {
        const hidden = afterCuts && route.status === "eliminated";
        if (hidden) return;
        const faded = afterCuts && route.status === "reduced";
        const bendBase = 6 + idx * 2.7;
        const bendDirection = node.x < CENTER_X ? -1 : 1;
        paths.push({
          key: `${node.name}-${route.routeId}-${idx}`,
          d: buildCurvedPath(node.x, node.y, CENTER_X, CENTER_Y, bendBase * bendDirection),
          opacity: faded ? 0.2 : 1,
        });
      });
    }
    return paths;
  }, [afterCuts, nodes]);

  return (
    <section className={styles.wrap} aria-label="Neighborhood to downtown route connections">
      <header className={styles.header}>
        <h2>Neighborhood Connections to Downtown</h2>
        <p>
          Circle size shows neighborhood population. Circle color shows poverty level. Toggle to compare current routes
          vs after service cuts.
        </p>
      </header>

      <div className={styles.toggleRow} role="group" aria-label="Route cut scenario toggle">
        <button
          type="button"
          className={!afterCuts ? styles.toggleActive : styles.toggleBtn}
          onClick={() => setAfterCuts(false)}
        >
          Current state
        </button>
        <button
          type="button"
          className={afterCuts ? styles.toggleActive : styles.toggleBtn}
          onClick={() => setAfterCuts(true)}
        >
          After cuts
        </button>
      </div>

      <svg className={styles.svg} viewBox={`0 0 ${SVG_W} ${SVG_H}`} role="img">
        <title>Neighborhood connections to downtown with route status toggle</title>

        <g aria-hidden>
          {linePaths.map((line) => (
            <path key={line.key} d={line.d} className={styles.link} style={{ opacity: line.opacity }} />
          ))}
        </g>

        <g>
          <circle cx={CENTER_X} cy={CENTER_Y} r={CENTER_R} className={styles.centerCircle} />
          <text x={CENTER_X} y={CENTER_Y + 5} textAnchor="middle" className={styles.centerLabel}>
            Downtown
          </text>
        </g>

        <g>
          {nodes.map((node) => (
            <g key={node.name}>
              <circle cx={node.x} cy={node.y} r={node.r} className={`${styles.node} ${styles[node.povertyBand]}`} />
              <text
                x={node.x}
                y={node.y + node.r + 16}
                textAnchor="middle"
                className={styles.nodeLabel}
              >
                {node.name}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div className={styles.legend}>
        <span>
          <i className={`${styles.swatch} ${styles.r3}`} /> 30%+ poverty
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.r2}`} /> 20% - 29.9%
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.n4}`} /> 10% - 19.9%
        </span>
        <span>
          <i className={`${styles.swatch} ${styles.g1}`} /> &lt; 10%
        </span>
      </div>
    </section>
  );
}
