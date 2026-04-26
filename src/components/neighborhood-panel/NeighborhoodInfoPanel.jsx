"use client";

import { useNeighborhoodPanel } from "../../contexts/NeighborhoodPanelContext";
import CommuteMethodGauge from "../data-viz/neighborhood-stats/CommuteMethodGauge";
import PovertyPictogram from "../data-viz/neighborhood-stats/PovertyPictogram";
import styles from "../data-viz/coverage-map/CoverageMap.module.css";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function NeighborhoodInfoPanel() {
  const { panelDisplay, coverageSelected, clearCoverageSelection, sidebarCollapsed, setSidebarCollapsed } =
    useNeighborhoodPanel();

  const row = panelDisplay?.profile;
  const wfh = row ? num(row.share_commute_worked_from_home) : null;
  const transit = row ? num(row.share_commute_public_transit) : null;
  const vehicleWalk = row
    ? num(row.share_commute_car_truck_van) +
      num(row.share_commute_walked) +
      num(row.share_commute_bicycle) +
      num(row.share_commute_other_modes)
    : null;
  const deepPov = row ? num(row.share_below_50pct_poverty_threshold) : null;
  const below100 = row ? num(row.share_below_100pct_poverty_threshold) : null;
  const highInc =
    row != null ? num(row.share_hh_income_100k_to_199k) + num(row.share_hh_income_200k_plus) : null;
  const totalPop = row ? Math.round(num(row.total_pop)) : null;
  const peoplePerDot = totalPop != null && totalPop > 0 ? Math.max(1, Math.round(totalPop / 50)) : 100;

  const showCharts = Boolean(coverageSelected && row);
  const routesLeadSelected = Boolean(coverageSelected);

  return (
    <aside
      className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}
      aria-label="Neighborhood details"
    >
      <div className={styles.sidebarInner}>
        <div className={styles.sidebarTop}>
          {panelDisplay ? (
            <h2 className={styles.hoodTitle}>{panelDisplay.neighborhood}</h2>
          ) : (
            <h2 className={styles.hoodTitleMuted}>Pittsburgh neighborhoods</h2>
          )}
          <button
            type="button"
            className={styles.collapseToggle}
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand panel" : "Collapse panel"}
          >
            {sidebarCollapsed ? "‹" : "›"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <>
            {showCharts && (
              <div className={styles.demoBlock}>
                <CommuteMethodGauge
                  workFromHomeShare={wfh}
                  vehicleWalkShare={vehicleWalk}
                  transitShare={transit}
                />
                <PovertyPictogram
                  belowPovertyLineShare={below100}
                  deepPovertyShare={deepPov}
                  highIncomeHouseholdShare={highInc}
                  peoplePerDot={peoplePerDot}
                />
                <button type="button" className={styles.clearBtn} onClick={clearCoverageSelection}>
                  Clear selection
                </button>
                <p className={styles.hint}>Press Esc to clear.</p>
              </div>
            )}

            {coverageSelected && !row && (
              <p className={styles.missingProfile}>
                No profile row found for this neighborhood (check that{" "}
                <code>neighborhood_display_profiles.csv</code> is built and synced).
              </p>
            )}

            {panelDisplay && (
              <div className={styles.routesBlock}>
                <p className={styles.routesLead}>
                  {routesLeadSelected ? "Routes" : "Hover a neighborhood"}{" "}
                  <span className={styles.coveragePill}>
                    lost coverage {(panelDisplay.lostCoverage * 100).toFixed(1)}%
                  </span>
                </p>
                <div className={styles.routeCols}>
                  <div>
                    <h3 className={styles.routeHeading}>Before ({panelDisplay.beforeCount})</h3>
                    <p className={styles.routeList}>{panelDisplay.beforeRoutes.join(", ") || "—"}</p>
                  </div>
                  <div>
                    <h3 className={styles.routeHeading}>After ({panelDisplay.afterCount})</h3>
                    <p className={styles.routeList}>{panelDisplay.afterRoutes.join(", ") || "—"}</p>
                  </div>
                </div>
              </div>
            )}

            {!panelDisplay && (
              <p className={styles.sidebarEmpty}>
                Hover a neighborhood on the coverage map or the schematic map to compare routes before and after FY26.
                Click a neighborhood on the coverage map to open commute and poverty charts (ACS).
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
