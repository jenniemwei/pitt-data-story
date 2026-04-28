"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { dataAssetUrl } from "../../../lib/dataAssetUrl";
import { buildRouteComparisonProps } from "../../../adapters/buildRouteComparisonProps";
import BusRouteComparison from "./BusRouteComparison";
import styles from "./BusRouteComparisonSection.module.css";

const STOP_ROUTE_CSV = "route_stop_per_route.csv";
const AREA_OPTIONS = ["downtown", "waterfront", "squirrel hill", "shadyside"];

function parseCsv(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    throw new Error(`Could not parse ${STOP_ROUTE_CSV}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
}

export default function BusRouteComparisonSection() {
  const [stopOptions, setStopOptions] = useState([]);
  const [selectedStopId, setSelectedStopId] = useState("");
  const [selectedArea, setSelectedArea] = useState("downtown");
  const [comparisonProps, setComparisonProps] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(dataAssetUrl(STOP_ROUTE_CSV))
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${STOP_ROUTE_CSV}: ${res.status} ${res.statusText}`);
        }
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        const rows = parseCsv(text);
        const seen = new Map();
        for (const row of rows) {
          const stopId = String(row.stop_id || "").trim();
          const stopName = String(row.stop_name || "").trim();
          if (!stopId || !stopName) continue;
          if (!seen.has(stopId)) seen.set(stopId, stopName);
        }
        const options = Array.from(seen.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
        setStopOptions(options);
        if (options.length > 0) setSelectedStopId(options[0].id);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedStopId) return;
    let cancelled = false;
    setError("");
    buildRouteComparisonProps(selectedStopId, selectedArea)
      .then((props) => {
        if (!cancelled) setComparisonProps(props);
      })
      .catch((err) => {
        if (cancelled) return;
        setComparisonProps(null);
        setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStopId, selectedArea]);

  const subtitle = useMemo(() => {
    if (!comparisonProps?.stop) return "";
    return `Selected stop: ${comparisonProps.stop.name} (${comparisonProps.stop.id}) · Area: ${selectedArea}`;
  }, [comparisonProps, selectedArea]);

  return (
    <section className={styles.section} aria-label="Bus route frequency comparison">
      <div className={styles.header}>
        <h2 className="type-h3 text-ink-default">Bus route comparison at a stop</h2>
        <p className="type-body-sm text-ink-secondary">
          Workflow: route must serve this stop, be a non-commuter bus, and touch the selected area. Headway uses{" "}
          <code>trips_wd</code> with <code>headwayMinutes = 60 / (trips_wd / 18)</code>; after-frequency applies fixed
          reductions (major 50%, minor 25%, eliminated 100%).
        </p>
      </div>

      <div className={styles.controls}>
        <label className={`${styles.selectLabel} type-data-label text-ink-secondary`}>
          Stop
          <select
            className={styles.select}
            value={selectedStopId}
            onChange={(event) => setSelectedStopId(event.target.value)}
          >
            {stopOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name} ({option.id})
              </option>
            ))}
          </select>
        </label>

        <label className={`${styles.selectLabel} type-data-label text-ink-secondary`}>
          Area
          <select className={styles.select} value={selectedArea} onChange={(event) => setSelectedArea(event.target.value)}>
            {AREA_OPTIONS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
      </div>

      {subtitle ? <p className="type-data-label text-ink-subtle">{subtitle}</p> : null}
      {error ? <p className="type-body-sm text-ink-default">{error}</p> : null}
      {!error && comparisonProps ? <BusRouteComparison {...comparisonProps} /> : null}
    </section>
  );
}
