"use client";

/**
 * TripPurposeProxy — “trip purpose” story block using employment industry as a proxy.
 * - Semantic regions: section (widget), header, aside (dynamic info), framed chart well.
 * - Visualization: vertical bubble stack (area ∝ share); retail + food merged for display.
 * - Interaction: hover/focus updates aside + optional floating tooltip.
 */
import { useCallback, useState } from "react";
import styles from "./TripPurposeProxy.module.css";

/** @typedef {'office_professional' | 'healthcare' | 'education' | 'retail_food' | 'manufacturing' | 'other'} BubbleIndustryKey */

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
 * Bubble chart uses a merged retail/food bucket so the legend matches a single “retail / food service” swatch.
 * @param {Record<string, number>} mix
 * @returns {Record<BubbleIndustryKey, number>}
 */
function mixForBubbles(mix) {
  return {
    office_professional: Number(mix.office_professional) || 0,
    healthcare: Number(mix.healthcare) || 0,
    education: Number(mix.education) || 0,
    retail_food: (Number(mix.retail) || 0) + (Number(mix.food_service) || 0),
    manufacturing: Number(mix.manufacturing) || 0,
    other: Number(mix.other) || 0,
  };
}

/** @type {{ key: BubbleIndustryKey; label: string; fillClass: string }[]} */
const BUBBLE_DEFS = [
  { key: "office_professional", label: "office job", fillClass: styles.fillOffice },
  { key: "healthcare", label: "healthcare", fillClass: styles.fillHealth },
  { key: "education", label: "education", fillClass: styles.fillEdu },
  { key: "retail_food", label: "retail / food service", fillClass: styles.fillRetailFood },
  { key: "manufacturing", label: "manufacturing", fillClass: styles.fillMfg },
  { key: "other", label: "other", fillClass: styles.fillOther },
];

/** Screen-reader-only when panel is collapsed or no bubble is focused. */
const INFO_PANEL_SR_EMPTY = "No category selected.";

/** Shown only in the hover “Corridor & methods” panel (not duplicated in page header). */
const TRIP_PURPOSE_METHODS_DISCLAIMER =
  "PRT does not publish trip purpose. Industry mix along each corridor is a stand-in: office-heavy corridors suggest more discretionary commutes; healthcare, retail, and food service suggest more shift-based, essential trips.";

/**
 * @param {Record<BubbleIndustryKey, number>} bubbleMix
 */
function totalBubbleWorkers(bubbleMix) {
  return BUBBLE_DEFS.reduce((sum, { key }) => sum + (Number(bubbleMix[key]) || 0), 0);
}

const SVG_W = 168;
const SVG_H = 400;
const BUBBLE_GAP = 5;
/** Must stay ≤ 1 or the stacked layout exceeds SVG_H and clips at the bottom. */
const BUBBLE_RADIUS_SCALE = 1;

/**
 * Vertical stack: largest share at top (matches common “headline category first” reading order).
 * Radii ∝ √(share) so area ∝ share.
 * @param {Record<BubbleIndustryKey, number>} bubbleMix
 */
function layoutBubbles(bubbleMix) {
  const total = totalBubbleWorkers(bubbleMix);
  if (total <= 0) return [];

  /** @type {{ key: BubbleIndustryKey; label: string; fillClass: string; count: number; frac: number }[]} */
  const items = [];
  for (const def of BUBBLE_DEFS) {
    const count = Number(bubbleMix[def.key]) || 0;
    if (count <= 0) continue;
    items.push({
      key: def.key,
      label: def.label,
      fillClass: def.fillClass,
      count,
      frac: count / total,
    });
  }

  items.sort((a, b) => b.count - a.count);

  const sqrtSum = items.reduce((s, x) => s + Math.sqrt(x.frac), 0);
  const gapTotal = (items.length - 1) * BUBBLE_GAP;
  const heightBudget = SVG_H - gapTotal;
  const k = sqrtSum > 0 ? (heightBudget / (2 * sqrtSum)) * BUBBLE_RADIUS_SCALE : 0;

  /** @type {number[]} */
  const radii = items.map((x) => k * Math.sqrt(x.frac));

  let yBottom = 0;
  /** @type {{ key: BubbleIndustryKey; label: string; fillClass: string; count: number; pct: number; cx: number; cy: number; r: number }[]} */
  const placed = [];

  for (let i = 0; i < items.length; i++) {
    const r = radii[i];
    const cy = i === 0 ? r : yBottom + BUBBLE_GAP + r;
    yBottom = cy + r;
    placed.push({
      ...items[i],
      pct: 100 * items[i].frac,
      cx: SVG_W / 2,
      cy,
      r,
    });
  }

  return placed;
}

/**
 * `label` / `subtitle` are legacy aliases for `corridorName` / `riderFraming`.
 * @typedef {{
 *   id: string;
 *   kind: "choice" | "dependent";
 *   corridorName?: string;
 *   riderFraming?: string;
 *   label?: string;
 *   subtitle?: string;
 * }} TripPurposeRouteColumn
 */

const DEFAULT_ROUTES = [
  {
    id: "routeA",
    kind: "choice",
    corridorName: "RED Line",
    riderFraming: "Choice",
  },
  {
    id: "routeB",
    kind: "dependent",
    corridorName: "52L (Homewood Limited)",
    riderFraming: "Need",
  },
];

/**
 * Employment-industry mix as a proxy for trip purpose (two corridor columns + dynamic info panel).
 *
 * @param {object} props
 * @param {Record<string, Record<string, number>>} [props.routeEmployment]
 * @param {TripPurposeRouteColumn[]} [props.routes]
 * @param {string} [props.dependentRouteId]
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
  dependentRouteId = "routeB",
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
    "Datasets: (1) LEHD LODES Workplace Area Characteristics (WAC) at census-block resolution — jobs by 2-digit NAICS rolled into the story buckets (e.g. healthcare ≈ NAICS 62; retail 44–45; food service 72; office / professional 51–56 subset; education 61; manufacturing 31–33; other remainder). (2) Alternatively, ACS 5-year Table B08124 (means of transportation to work by industry) for residents in the same corridor geographies, filtered to transit modes. Bubble area ∝ category count; retail and food service are merged for display.";

  /** @param {TripPurposeRouteColumn} r */
  const corridorLabel = (r) => r.corridorName ?? r.label ?? r.id;

  /** @param {TripPurposeRouteColumn} r */
  const riderCaption = (r) => r.riderFraming ?? r.subtitle ?? "";

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
            <p className={`${styles.dek} narrativeLine narrativeLineWide`}>{dek}</p>
          ) : null}
        </header>
      ) : null}

      {/* Main grid: collapse control + optional info (~1/4) + bubble chart (~3/4) */}
      <div className={`${styles.body} ${infoPanelOpen ? "" : styles.bodyChartOnly}`}>
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
        ) : (
          <div id={infoPanelId} className="visually-hidden" aria-live="polite">
            {panelFocus
              ? `${panelFocus.segmentLabel}, ${panelFocus.count} workers, ${panelFocus.pct.toFixed(1)} percent of ${panelFocus.routeLabel}`
              : INFO_PANEL_SR_EMPTY}
          </div>
        )}

        <div className={styles.chartWell}>
          <div className={styles.chartWellInner}>
            {/* Category legend — order matches design mock */}
            <ul className={styles.legend} aria-label="Industry categories">
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchOffice}`} aria-hidden />
                office job
              </li>
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchHealth}`} aria-hidden />
                healthcare
              </li>
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchEdu}`} aria-hidden />
                education
              </li>
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchRetailFood}`} aria-hidden />
                retail / food service
              </li>
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchMfg}`} aria-hidden />
                manufacturing
              </li>
              <li className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles.swatchOther}`} aria-hidden />
                other
              </li>
            </ul>

            <div className={styles.columns}>
              {routes.map((route) => {
                const raw = routeEmployment[route.id];
                if (!raw) return null;
                const bubbleMix = mixForBubbles(raw);
                const total = totalBubbleWorkers(bubbleMix);
                const bubbles = layoutBubbles(bubbleMix);
                const routeTitle = corridorLabel(route);
                const framing = riderCaption(route);

                return (
                  <figure key={route.id} className={styles.column}>
                    <figcaption className={styles.columnCaption}>
                      <span className={styles.columnTitle}>
                        <span
                          className={`${styles.columnBadge} ${
                            route.kind === "dependent" ? styles.badgeDependent : styles.badgeChoice
                          }`}
                          aria-hidden
                        >
                          {route.kind === "dependent" ? "N" : "C"}
                        </span>
                        {routeTitle}
                      </span>
                      {framing ? <span className={styles.columnSubtitle}>{framing}</span> : null}
                    </figcaption>

                    <svg
                      className={styles.bubbleSvg}
                      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                      role="img"
                      aria-label={`${routeTitle}: employment mix across ${total} workers in model data`}
                    >
                      <title>
                        {`${routeTitle}: bubble sizes show employment share by industry category.`}
                      </title>
                      {[...bubbles].reverse().map((b) => (
                        <g key={b.key}>
                          <circle
                            className={`${b.fillClass} ${styles.bubbleHit}`}
                            cx={b.cx}
                            cy={b.cy}
                            r={b.r}
                            tabIndex={0}
                            aria-label={`${b.label}: ${b.count} workers, ${b.pct.toFixed(1)} percent`}
                            onMouseMove={(e) =>
                              onSegMove(e, {
                                routeLabel: routeTitle,
                                segmentLabel: b.label,
                                count: b.count,
                                pct: b.pct,
                              })
                            }
                            onMouseLeave={onSegLeave}
                            onFocus={(e) => {
                              const rct = e.currentTarget.getBoundingClientRect();
                              onSegMove(
                                { clientX: rct.left + rct.width / 2, clientY: rct.top },
                                {
                                  routeLabel: routeTitle,
                                  segmentLabel: b.label,
                                  count: b.count,
                                  pct: b.pct,
                                },
                              );
                            }}
                            onBlur={onSegLeave}
                          />
                        </g>
                      ))}
                    </svg>
                  </figure>
                );
              })}
            </div>
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
