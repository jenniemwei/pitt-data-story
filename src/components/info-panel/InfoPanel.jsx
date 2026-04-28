"use client";

import { useEffect, useState } from "react";
import { useNeighborhoodPanel } from "../../contexts/NeighborhoodPanelContext";
import CommuteMethodGauge from "./components/CommuteVis";
import PovertyPictogram from "./components/IncomeVis";
import styles from "./InfoPanel.module.css";

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const STUDENT_SKEWED = new Set([
  "Central Oakland",
  "North Oakland",
  "South Oakland",
  "Bluff",
  "South Side Flats",
  "Shadyside",
  "Squirrel Hill North",
  "Squirrel Hill South",
  "Terrace Village",
  "West Oakland",
]);

export default function NeighborhoodInfoPanel() {
  const { panelDisplay } = useNeighborhoodPanel();
  const [useAge25Plus, setUseAge25Plus] = useState(true);

  const row = panelDisplay?.profile;
  const neighborhoodName = String(panelDisplay?.neighborhood || "").trim();
  const isStudentSkewed = STUDENT_SKEWED.has(neighborhoodName);
  const hasAge25PlusField = row && String(row.share_below_100pct_poverty_25plus || "").trim() !== "";
  const showAge25PlusToggle = Boolean(isStudentSkewed && hasAge25PlusField);
  const canUseAge25Plus = showAge25PlusToggle;

  useEffect(() => {
    setUseAge25Plus(true);
  }, [neighborhoodName]);

  const wfh = row ? num(row.share_commute_worked_from_home) : null;
  const transit = row ? num(row.share_commute_public_transit) : null;
  const vehicleWalk = row
    ? num(row.share_commute_car_truck_van) +
      num(row.share_commute_walked) +
      num(row.share_commute_bicycle) +
      num(row.share_commute_other_modes)
    : null;
  const deepPov = row ? num(row.share_below_50pct_poverty_threshold) : null;
  const below100AllAges = row
    ? num(
        row.share_below_100pct_poverty_threshold_all_ages,
        num(row.share_below_100pct_poverty_threshold),
      )
    : null;
  const below100 = row
    ? canUseAge25Plus && useAge25Plus
      ? num(row.share_below_100pct_poverty_25plus, below100AllAges)
      : below100AllAges
    : null;
  const highInc =
    row != null ? num(row.share_hh_income_100k_to_199k) + num(row.share_hh_income_200k_plus) : null;
  const rawPop = row ? num(row.total_pop) : NaN;
  const totalPop = Number.isFinite(rawPop) && rawPop >= 0 ? Math.round(rawPop) : null;
  const rawPop25Plus = row ? num(row.pop_25_plus, NaN) : NaN;
  const pop25Plus = Number.isFinite(rawPop25Plus) && rawPop25Plus >= 0 ? Math.round(rawPop25Plus) : null;
  const populationForDots =
    canUseAge25Plus && useAge25Plus && pop25Plus != null ? pop25Plus : totalPop;
  const peoplePerDot =
    populationForDots != null && populationForDots > 0
      ? Math.max(1, Math.round(populationForDots / 50))
      : 100;

  const hasProfile = Boolean(panelDisplay && row);
  const reducedRoutes = panelDisplay?.afterRouteItems?.filter((item) => item.status === "reduced").map((item) => item.id) || [];
  const unaffectedRoutes =
    panelDisplay?.afterRouteItems?.filter((item) => item.status !== "reduced").map((item) => item.id) || [];
  const afterRouteSet = new Set(panelDisplay?.afterRouteItems?.map((item) => item.id) || []);
  const eliminatedRoutes = (panelDisplay?.beforeRoutes || []).filter((id) => !afterRouteSet.has(id));
  const routesLeadLabel = panelDisplay?.routesLeadLabel || "Routes";

  return (
    <aside className={styles.sidebar} aria-label="Neighborhood details">
      <div className={styles.sidebarInner}>
        <div className={styles.bottomContent}>
          <div className={styles.sidebarTop}>
            {panelDisplay ? (
              <>
                <h2 className={`${styles.hoodTitle} type-h2-serif text-ink-default`}>{panelDisplay.neighborhood}</h2>
                {canUseAge25Plus && useAge25Plus && pop25Plus != null ? (
                  <>
                    <p className={`${styles.populationMeta} type-body text-ink-secondary`}>
                      Population (25+):{" "}
                      <span className={`tabular-nums text-ink-default`}>{pop25Plus.toLocaleString("en-US")}</span>
                    </p>
                    {totalPop != null ? (
                      <p className={`${styles.populationMeta} type-body text-ink-secondary`}>
                        All ages: <span className={`tabular-nums`}>{totalPop.toLocaleString("en-US")}</span>
                      </p>
                    ) : null}
                  </>
                ) : totalPop != null ? (
                  <p className={`${styles.populationMeta} type-body text-ink-secondary`}>
                    Population{" "}
                    <span className={`tabular-nums text-ink-default`}>{totalPop.toLocaleString("en-US")}</span>
                  </p>
                ) : null}
                {showAge25PlusToggle ? (
                  <label className={`${styles.ageToggle} type-body text-ink-secondary`}>
                    <input
                      type="checkbox"
                      checked={useAge25Plus}
                      disabled={!canUseAge25Plus}
                      onChange={(e) => setUseAge25Plus(e.target.checked)}
                    />
                    <span>
                      Use age 25+ poverty data
                      {!canUseAge25Plus ? " (2024 only)" : ""}
                    </span>
                  </label>
                ) : null}
              </>
            ) : (
              <h2 className={`${styles.hoodTitleMuted} type-h2-serif text-ink-secondary`}>Pittsburgh neighborhoods</h2>
            )}
          </div>

          {panelDisplay && (
            <div className={styles.routesBlock}>
              <p className={`${styles.routesLead} type-body text-ink-default`}>
                {routesLeadLabel} ({panelDisplay.beforeCount}){" "}
                <span className={`${styles.coveragePill} type-h4-mono-allcaps text-ink-secondary`}>
                  lost coverage {(panelDisplay.lostCoverage * 100).toFixed(1)}%
                </span>
              </p>
              <div className={styles.routeCols}>
                <div className={styles.routeGroup}>
                  <h3 className={`${styles.routeHeading} type-h4-mono-allcaps text-ink-secondary`}>
                    Unaffected ({unaffectedRoutes.length})
                  </h3>
                  <p className={`${styles.routeList} type-h4-mono-allcaps text-ink-default`}>
                    {unaffectedRoutes.join(", ") || "—"}
                  </p>
                </div>
                <div className={styles.routeGroup}>
                  <h3 className={`${styles.routeHeading} type-h4-mono-allcaps text-ink-secondary`}>
                    Eliminated ({eliminatedRoutes.length})
                  </h3>
                  <p className={`${styles.routeList} type-h4-mono-allcaps text-ink-default`}>
                    {eliminatedRoutes.join(", ") || "—"}
                  </p>
                </div>
                <div className={styles.routeGroup}>
                  <h3 className={`${styles.routeHeading} type-h4-mono-allcaps text-ink-secondary`}>
                    Reduced ({reducedRoutes.length})
                  </h3>
                  <p className={`${styles.routeList} type-h4-mono-allcaps text-ink-default`}>
                    {reducedRoutes.join(", ") || "—"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {panelDisplay && !row && (
            <p className={`${styles.missingProfile} type-body text-ink-secondary`}>
              No profile row found for this neighborhood (check that <code>display_profiles_2024.csv</code> is
              built and synced).
            </p>
          )}

          {!panelDisplay && (
            <p className={`${styles.sidebarEmpty} type-body text-ink-secondary`}>
              Hover a neighborhood on any map to see poverty and commute data for residents.
            </p>
          )}
        </div>

        <div className={styles.topContent}>
          <div className={styles.demoBlock}>
            <CommuteMethodGauge
              workFromHomeShare={wfh}
              vehicleWalkShare={vehicleWalk}
              transitShare={transit}
              hideHeadlineValue={!hasProfile}
            />
            <PovertyPictogram
              belowPovertyLineShare={below100}
              deepPovertyShare={deepPov}
              highIncomeHouseholdShare={highInc}
              peoplePerDot={peoplePerDot}
              hideHeadlineValue={!hasProfile}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
