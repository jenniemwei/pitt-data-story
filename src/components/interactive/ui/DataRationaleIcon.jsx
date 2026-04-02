"use client";

import styles from "./DataRationaleIcon.module.css";

/**
 * Standardized “?” control: hover or focus shows a small rationale card (replaces long on-page captions).
 *
 * @param {object} props
 * @param {string} props.rationale — short paragraph(s); plain text (line breaks via {"\n"} if needed)
 * @param {string} [props.label] — accessible name for the button (default: “Why we show this”)
 * @param {string} [props.className]
 */
export function DataRationaleIcon({ rationale, label = "Why we show this", className = "" }) {
  return (
    <span className={`${styles.wrap} ${className}`.trim()}>
      <button type="button" className={styles.btn} aria-label={label}>
        <span aria-hidden>?</span>
      </button>
      <span className={styles.card} role="tooltip">
        {rationale}
      </span>
    </span>
  );
}
