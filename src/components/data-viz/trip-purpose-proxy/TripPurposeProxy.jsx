"use client";

/**
 * TripPurposeProxy — “trip purpose” story block using employment industry as a proxy.
 * - Semantic regions: section (widget), header, aside (dynamic info), framed chart well.
 * - Visualization: dot pictogram (dots scale down proportionally when a route total exceeds a cap); retail + food merged; manufacturing rolled into “other” for the legend.
 * - Interaction: hover/focus on a category column updates aside + optional floating tooltip.
 */
import { useCallback, useState } from "react";
import styles from "./TripPurposeProxy.module.css";

/** @typedef {'office_professional' | 'healthcare' | 'education' | 'retail_food' | 'other'} TripPurposeDisplayKey */

/**
 * Illustrative employment mix by route corridor (transit riders / corridor workers).
 * Replace with LEHD LODES or ACS B08124 pull for PA / Pittsburgh.
 */
export const DEFAULT_ROUTE_EMPLOYMENT = {
  routeA: {
    healthcare: 14,
    retail: 11,
    office_professional: 38,
    food_service: 9,
    education: 12,
    manufacturing: 8,
    other: 8,
  },
  routeB: {
    healthcare: 31,
    retail: 18,
    office_professional: 11,
    food_service: 19,
    education: 16,
    manufacturing: 9,
    other: 6,
  },
};

/**
 * Pictogram buckets: merged retail/food; manufacturing folded into other for display.
 * @param {Record<string, number>} mix
 * @returns {Record<TripPurposeDisplayKey, number>}
 */
function mixForDots(mix) {
  return {
    office_professional: Number(mix.office_professional) || 0,
    healthcare: Number(mix.healthcare) || 0,
    education: Number(mix.education) || 0,
    retail_food: (Number(mix.retail) || 0) + (Number(mix.food_service) || 0),
    other: (Number(mix.other) || 0) + (Number(mix.manufacturing) || 0),
  };
}

/** @type {{ key: TripPurposeDisplayKey; label: string; tokenLabel: string; swatchClass: string; dotClass: string }[]} */
const DOT_DEFS = [
  {
    key: "office_professional",
    label: "Office",
    tokenLabel: "accent1",
    swatchClass: styles.swatchAccent1,
    dotClass: styles.dotAccent1,
  },
  {
    key: "education",
    label: "Education",
    tokenLabel: "accent2",
    swatchClass: styles.swatchAccent2,
    dotClass: styles.dotAccent2,
  },
  {
    key: "healthcare",
    label: "Healthcare",
    tokenLabel: "accent3",
    swatchClass: styles.swatchAccent3,
    dotClass: styles.dotAccent3,
  },
  {
    key: "retail_food",
    label: "Retail / food service",
    tokenLabel: "accent4",
    swatchClass: styles.swatchAccent4,
    dotClass: styles.dotAccent4,
  },
  {
    key: "other",
    label: "Other",
    tokenLabel: "g4",
    swatchClass: styles.swatchG4,
    dotClass: styles.dotG4,
  },
];

/** Screen-reader-only when panel is collapsed or no category is focused. */
const INFO_PANEL_SR_EMPTY = "No category selected.";

/** Shown only in the hover “Corridor & methods” panel (not duplicated in page header). */
const TRIP_PURPOSE_METHODS_DISCLAIMER =
  "PRT does not publish trip purpose. Industry mix along each corridor is a stand-in: office-heavy corridors suggest more discretionary commutes; healthcare, retail, and food service suggest more shift-based, essential trips.";

/** @param {Record<TripPurposeDisplayKey, number>} displayMix */
function totalWorkers(displayMix) {
  return DOT_DEFS.reduce((sum, { key }) => sum + (Number(displayMix[key]) || 0), 0);
}

/** Max dots drawn per route (keeps DOM light); proportions match rider counts. */
const MAX_ROUTE_DOTS = 120;

const MAX_DOT_ROWS = 14;

/**
 * When total workers exceed MAX_ROUTE_DOTS, scale each category’s dot count
 * proportionally (largest remainder) so the pictogram stays readable.
 * @param {Record<TripPurposeDisplayKey, number>} mix
 * @returns {{ display: Record<TripPurposeDisplayKey, number>; total: number }}
 */
function visibleDotCounts(mix) {
  const total = totalWorkers(mix);
  /** @type {Record<TripPurposeDisplayKey, number>} */
  const zeros = Object.fromEntries(DOT_DEFS.map((d) => [d.key, 0]));
  if (total <= 0) return { display: zeros, total: 0 };
  if (total <= MAX_ROUTE_DOTS) {
    /** @type {Record<TripPurposeDisplayKey, number>} */
    const display = { ...zeros };
    for (const { key } of DOT_DEFS) display[key] = Number(mix[key]) || 0;
    return { display, total };
  }
  const budget = MAX_ROUTE_DOTS;
  const keys = DOT_DEFS.map((d) => d.key);
  const counts = keys.map((k) => Number(mix[k]) || 0);
  const exacts = counts.map((c) => (c / total) * budget);
  const floors = exacts.map((x) => Math.floor(x));
  let rem = budget - floors.reduce((a, b) => a + b, 0);
  const idxOrder = keys
    .map((_, i) => i)
    .sort((a, b) => exacts[b] - floors[b] - (exacts[a] - floors[a]));
  /** @type {Record<TripPurposeDisplayKey, number>} */
  const display = { ...zeros };
  for (let i = 0; i < keys.length; i++) display[keys[i]] = floors[i];
  for (let k = 0; k < rem; k++) display[keys[idxOrder[k]]] += 1;
  return { display, total };
}

/**
 * Column-major dot grid: fill up to MAX_DOT_ROWS tall, then add columns to the right.
 * @param {number} count
 */
function dotGridDims(count) {
  if (count <= 0) return { cols: 0, rows: 0 };
  const cols = Math.ceil(count / MAX_DOT_ROWS);
  const rows = Math.min(count, MAX_DOT_ROWS);
  return { cols, rows };
}

/**
 * @typedef {{
 *   id: string;
 *   kind: "choice" | "dependent";
 *   corridorName?: string;
 *   riderFraming?: string;
 * }} TripPurposeRouteColumn
 */

const DEFAULT_ROUTES = [
  {
    id: "routeA",
    kind: "choice",
    corridorName: "71B Highland Park — Choice",
    riderFraming: "",
  },
  {
    id: "routeB",
    kind: "dependent",
    corridorName: "P10 Allegheny Valley — Need",
    riderFraming: "",
  },
];

/**
 * Employment-industry mix as a proxy for trip purpose (dynamic info panel above chart + wide dot rows).
 *
 * @param {object} props
 * @param {Record<string, Record<string, number>>} [props.routeEmployment]
 * @param {TripPurposeRouteColumn[]} [props.routes]
 * @param {string} [props.title]
 * @param {string} [props.dek]
 * @param {string} [props.sourceNote]
 * @param {string} [props.corridorDefinitionNote]
 * @param {string} [props.dataAndMethodsNote]
 * @param {string} [props.instanceId] — stable DOM id prefix for a11y (avoids useId SSR/client drift / hydration issues)
 * @param {boolean} [props.infoPanelDefaultOpen] — left info column visible (can be minimized)
 */
export function TripPurposeProxy({
  routeEmployment = DEFAULT_ROUTE_EMPLOYMENT,
  routes = DEFAULT_ROUTES,
  title = "Industry mix along the corridor",
  dek = "",
  sourceNote = null,
  corridorDefinitionNote = null,
  dataAndMethodsNote = null,
  instanceId = "trip-purpose-proxy",
  infoPanelDefaultOpen = true,
}) {
  const [infoPanelOpen, setInfoPanelOpen] = useState(infoPanelDefaultOpen);

  const [tip, setTip] = useState(
    /** @type {{ x: number; y: number; routeLabel: string; segmentLabel: string; count: number; pct: number } | null} */ (
      null
    ),
  );

  const [panelFocus, setPanelFocus] = useState(
    /** @type {{ routeLabel: string; segmentLabel: string; count: number; pct: number } | null} */ (null),
  );

  const defaultSource =
    "Industry data: LEHD Origin-Destination Employment Statistics (LODES) or ACS Table B08124 (means of transportation to work by industry). Replace with confirmed PA / Pittsburgh pull.";

  const defaultCorridorDefinition =
    "Each “corridor” is a geographic catchment around a persona’s PRT route: typically census blocks or block groups that intersect a buffer along the route alignment or near stops (for example ¼–½ mile). Exact distance and vintage should match your published map. This chart uses illustrative counts until you replace them with an aggregated pull for those geographies.";

  const defaultDataAndMethods =
    "Datasets: (1) LEHD LODES Workplace Area Characteristics (WAC) at census-block resolution — jobs by 2-digit NAICS rolled into the story buckets (e.g. healthcare ≈ NAICS 62; retail 44–45; food service 72; office / professional 51–56 subset; education 61; manufacturing 31–33; other remainder). (2) Alternatively, ACS 5-year Table B08124 (means of transportation to work by industry) for residents in the same corridor geographies, filtered to transit modes. Dot columns are proportional to category counts (one dot per worker up to a per-route cap, then scaled); hover shows exact counts. Category colors use accent1–accent4 and g4; retail and food service are merged for display and manufacturing counts are included in other.";

  /** @param {TripPurposeRouteColumn} r */
  const corridorLabel = (r) => r.corridorName ?? r.id;

  /** @param {TripPurposeRouteColumn} r */
  const riderCaption = (r) => r.riderFraming ?? "";

  const onSegMove = useCallback((e, payload) => {
    setTip({
      x: e.clientX,
      y: e.clientY,
      ...payload,
    });
    setPanelFocus({
      routeLabel: payload.routeLabel,
      segmentLabel: payload.segmentLabel,
      count: payload.count,
      pct: payload.pct,
    });
  }, []);

  const onSegLeave = useCallback(() => {
    setTip(null);
    setPanelFocus(null);
  }, []);

  const headingId = `${instanceId}-heading`;
  const methodsPanelId = `${instanceId}-methods`;
  const methodsTriggerId = `${instanceId}-methods-trigger`;
  const infoPanelId = `${instanceId}-info`;

  return (
    <section className={styles.purposeProxy} aria-labelledby={title ? headingId : undefined}>
      {/* Page header: title + methods disclosure */}
      {title ? (
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h2 id={headingId} className={styles.title}>
              {title}
            </h2>
            <div className={styles.methodsWrap}>
              <button
                type="button"
                className={styles.methodsTrigger}
                aria-controls={methodsPanelId}
                id={methodsTriggerId}
                aria-label="Corridor definition, data sources, and calculations (hover or focus here to read)"
              >
                <span className={styles.methodsIcon} aria-hidden>
                  i
                </span>
                Corridor & methods
              </button>
              <div
                id={methodsPanelId}
                className={styles.methodsPanel}
                role="region"
                aria-labelledby={methodsTriggerId}
              >
                <h3 className={styles.methodsPanelHeading}>Trip purpose proxy</h3>
                <p>{TRIP_PURPOSE_METHODS_DISCLAIMER}</p>
                <h3 className={styles.methodsPanelHeading}>How corridors are defined</h3>
                <p>{corridorDefinitionNote ?? defaultCorridorDefinition}</p>
                <h3 className={styles.methodsPanelHeading}>Data sources & calculations</h3>
                <p>{dataAndMethodsNote ?? defaultDataAndMethods}</p>
              </div>
            </div>
          </div>
          {dek ? (
            <p className={`${styles.dek} type-story-line type-story-line-wide text-ink-default`}>{dek}</p>
          ) : null}
        </header>
      ) : null}

      {/* Data panel on top; chart below with legend above wide dot rows */}
      <div className={styles.bodyStack}>
        <div className={styles.bodyTopBar}>
          <button
            type="button"
            className={styles.edgeToggle}
            onClick={() => setInfoPanelOpen((o) => !o)}
            aria-expanded={infoPanelOpen}
            aria-controls={infoPanelId}
            aria-label={infoPanelOpen ? "Hide corridor details" : "Show corridor details"}
          >
            <span className={styles.edgeToggleGlyph} aria-hidden>
              {infoPanelOpen ? "\u2039" : "\u203A"}
            </span>
          </button>
          {infoPanelOpen ? (
            <aside
              className={styles.infoPanel}
              id={infoPanelId}
              aria-live="polite"
              aria-label="Corridor category details"
            >
              {panelFocus ? (
                <p className={styles.infoPanelBody}>
                  <strong>{panelFocus.segmentLabel}</strong>
                  {", "}
                  {panelFocus.count.toLocaleString()} workers ({panelFocus.pct.toFixed(1)}% of{" "}
                  {panelFocus.routeLabel}).
                </p>
              ) : null}
            </aside>
          ) : null}
        </div>
        {!infoPanelOpen ? (
          <div id={infoPanelId} className="sr-only" aria-live="polite">
            {panelFocus
              ? `${panelFocus.segmentLabel}, ${panelFocus.count} workers, ${panelFocus.pct.toFixed(1)} percent of ${panelFocus.routeLabel}`
              : INFO_PANEL_SR_EMPTY}
          </div>
        ) : null}

        <div className={styles.chartWell}>
          <ul className={styles.legend} aria-label="Industry categories">
            {DOT_DEFS.map((def) => (
              <li key={def.key} className={styles.legendItem}>
                <span className={`${styles.swatch} ${def.swatchClass}`} aria-hidden />
                <span className={styles.legendCopy}>
                  <span className={styles.legendName}>{def.label.toLowerCase()}</span>{" "}
                  <span className={`type-data-mono text-ink-disclaimer`}>({def.tokenLabel})</span>
                </span>
              </li>
            ))}
          </ul>

          <div className={styles.routeRows}>
            {routes.map((route) => {
              const raw = routeEmployment[route.id];
              if (!raw) return null;
              const displayMix = mixForDots(raw);
              const total = totalWorkers(displayMix);
              const { display: dotDisplayMix } = visibleDotCounts(displayMix);
              const routeTitle = corridorLabel(route);
              const framing = riderCaption(route);

              return (
                <figure key={route.id} className={styles.routeRow}>
                  <figcaption className={styles.routeLabelCol}>
                    <span className={styles.routeLineName}>
                      <span
                        className={`${styles.columnBadge} ${
                          route.kind === "dependent" ? styles.badgeDependent : styles.badgeChoice
                        }`}
                        aria-hidden
                      >
                        {route.kind === "dependent" ? "N" : "C"}
                      </span>
                      <span className={styles.routeLineTitle}>{routeTitle}</span>
                    </span>
                    {framing ? <span className={styles.routeLineSubtitle}>{framing}</span> : null}
                  </figcaption>

                  <div
                    className={styles.dotRow}
                    role="group"
                    aria-label={`${routeTitle}: employment mix, ${total} workers in model data`}
                  >
                    {DOT_DEFS.map((def) => {
                      const countActual = Number(displayMix[def.key]) || 0;
                      const pct = total > 0 ? (100 * countActual) / total : 0;
                      const dotsToDraw = Number(dotDisplayMix[def.key]) || 0;
                      const { cols, rows } = dotGridDims(dotsToDraw);

                      return (
                        <div
                          key={def.key}
                          className={styles.categoryColumn}
                          tabIndex={countActual > 0 ? 0 : -1}
                          aria-label={`${def.label}: ${countActual} workers, ${pct.toFixed(1)} percent`}
                          onMouseMove={(e) => {
                            if (countActual <= 0) return;
                            onSegMove(e, {
                              routeLabel: routeTitle,
                              segmentLabel: def.label,
                              count: countActual,
                              pct,
                            });
                          }}
                          onMouseLeave={onSegLeave}
                          onFocus={(e) => {
                            if (countActual <= 0) return;
                            const rct = e.currentTarget.getBoundingClientRect();
                            onSegMove(
                              { clientX: rct.left + rct.width / 2, clientY: rct.top },
                              {
                                routeLabel: routeTitle,
                                segmentLabel: def.label,
                                count: countActual,
                                pct,
                              },
                            );
                          }}
                          onBlur={onSegLeave}
                        >
                          {dotsToDraw > 0 ? (
                            <div
                              className={styles.dotGrid}
                              style={{
                                gridTemplateRows: `repeat(${rows}, var(--dot-size))`,
                                gridTemplateColumns: `repeat(${cols}, var(--dot-size))`,
                              }}
                            >
                              {Array.from({ length: dotsToDraw }, (_, i) => (
                                <span key={i} className={`${styles.dot} ${def.dotClass}`} aria-hidden />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </figure>
              );
            })}
          </div>
        </div>
      </div>

      <p className={styles.source}>{sourceNote ?? defaultSource}</p>

      {tip ? (
        <div
          className={styles.tooltip}
          style={{
            left: Math.min(
              typeof window !== "undefined" ? window.innerWidth - 220 : tip.x + 12,
              tip.x + 12,
            ),
            top: tip.y + 12,
          }}
          role="tooltip"
        >
          <div className={styles.tooltipTitle}>{tip.segmentLabel}</div>
          <div>{tip.routeLabel}</div>
          <div className={styles.tooltipMuted}>
            {tip.count} workers · {tip.pct.toFixed(1)}%
          </div>
        </div>
      ) : null}
    </section>
  );
}
