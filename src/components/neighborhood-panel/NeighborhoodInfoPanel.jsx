"use client";

import { useNeighborhoodPanel } from "../../contexts/NeighborhoodPanelContext";
import CommuteMethodGauge from "../data-viz/neighborhood-stats/CommuteMethodGauge";
import PovertyPictogram from "../data-viz/neighborhood-stats/PovertyPictogram";
import styles from "./NeighborhoodInfoPanel.module.css";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default function NeighborhoodInfoPanel() {
  const { panelDisplay } = useNeighborhoodPanel();

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
  const rawPop = row ? num(row.total_pop) : NaN;
  const totalPop = Number.isFinite(rawPop) && rawPop >= 0 ? Math.round(rawPop) : null;
  const peoplePerDot = totalPop != null && totalPop > 0 ? Math.max(1, Math.round(totalPop / 50)) : 100;

  const showCharts = Boolean(panelDisplay && row);
  const routesLeadLabel = panelDisplay ? "Routes" : "Hover a neighborhood";

  return (
    <aside className={styles.sidebar} aria-label="Neighborhood details">
      <div className={styles.sidebarInner}>
        <div className={styles.sidebarTop}>
          {panelDisplay ? (
            <>
              <h2 className={`${styles.hoodTitle} type-h2 text-ink-default`}>{panelDisplay.neighborhood}</h2>
              {totalPop != null ? (
                <p className={`${styles.populationMeta} type-body-sm text-ink-secondary`}>
                  Population{" "}
                  <span className={`tabular-nums text-ink-default`}>{totalPop.toLocaleString("en-US")}</span>
                </p>
              ) : null}
            </>
          ) : (
            <h2 className={`${styles.hoodTitleMuted} type-h2 text-ink-secondary`}>Pittsburgh neighborhoods</h2>
          )}
        </div>

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
          </div>
        )}

        {panelDisplay && !row && (
          <p className={`${styles.missingProfile} type-body-sm text-ink-secondary`}>
            No profile row found for this neighborhood (check that <code>neighborhood_display_profiles.csv</code> is
            built and synced).
          </p>
        )}

        {panelDisplay && (
          <div className={styles.routesBlock}>
            <p className={`${styles.routesLead} type-body-sm text-ink-default`}>
              {routesLeadLabel}{" "}
              <span className={`${styles.coveragePill} type-data-route-label text-ink-secondary`}>
                lost coverage {(panelDisplay.lostCoverage * 100).toFixed(1)}%
              </span>
            </p>
            <div className={styles.routeCols}>
              <div>
                <h3 className={`${styles.routeHeading} type-data-route-label text-ink-secondary`}>
                  Before ({panelDisplay.beforeCount})
                </h3>
                <p className={`${styles.routeList} type-data-label text-ink-default`}>
                  {panelDisplay.beforeRoutes.join(", ") || "—"}
                </p>
              </div>
              <div>
                <h3 className={`${styles.routeHeading} type-data-route-label text-ink-secondary`}>
                  After ({panelDisplay.afterCount})
                </h3>
                <p className={`${styles.routeList} type-data-label text-ink-default`}>
                  {panelDisplay.afterRouteItems?.length
                    ? panelDisplay.afterRouteItems.map((item, i) => (
                        <span key={item.id}>
                          {i > 0 && ", "}
                          <span
                            className={item.status === "reduced" ? styles.routeNameReduced : undefined}
                            title={item.status === "reduced" ? "Service reduced" : undefined}
                          >
                            {item.id}
                          </span>
                        </span>
                      ))
                    : panelDisplay.afterRoutes.join(", ") || "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {!panelDisplay && (
          <p className={`${styles.sidebarEmpty} type-body-sm text-ink-secondary`}>
            Hover a neighborhood on the coverage map or the schematic map to see commute and poverty (ACS), and to
            compare routes before and after FY26. Click a neighborhood on the coverage map to persist selection and fit
            bounds. Re-center the map or click outside a neighborhood to clear selection.
          </p>
        )}
      </div>
    </aside>
  );
}
