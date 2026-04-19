import { Children } from "react";

import styles from "./GalleryRow.module.css";

/**
 * @typedef {"60-40"|"40-60"|"50-50"|"100"|"70-30"|"30-70"|"75-25"|"25-75"|"fit-fill"|"fill-fit"} GalleryRowVariant
 */

/** @param {GalleryRowVariant} variant */
function variantClassName(variant) {
  switch (variant) {
    case "60-40":
      return styles.row6040;
    case "40-60":
      return styles.row4060;
    case "50-50":
      return styles.row5050;
    case "100":
      return styles.row100;
    case "70-30":
      return styles.row7030;
    case "30-70":
      return styles.row3070;
    case "75-25":
      return styles.row7525;
    case "25-75":
      return styles.row2575;
    case "fit-fill":
      return styles.rowFitFill;
    case "fill-fit":
      return styles.rowFillFit;
    default:
      return styles.row100;
  }
}

/**
 * Shared grid row (portfoliov2-style). Each child is wrapped in `.cell`.
 * @param {{
 *   variant: GalleryRowVariant;
 *   children: import("react").ReactNode;
 *   measure?: "gallery" | "content";
 *   className?: string;
 *   cellClassName?: (index: number) => string | undefined;
 *   layoutId?: string;
 * }} props
 */
export function GalleryRow({
  variant,
  children,
  measure = "gallery",
  className = "",
  cellClassName,
  layoutId,
}) {
  const rowClass = measure === "gallery" ? styles.row : styles.rowContent;
  const vClass = variantClassName(variant);
  const isFitFill = variant === "fit-fill";
  const isFillFit = variant === "fill-fit";

  return (
    <div
      className={`${rowClass} ${vClass} ${className}`.trim()}
      {...(layoutId ? { "data-layout-id": layoutId } : {})}
    >
      {Children.map(children, (child, index) => {
        const extra = cellClassName?.(index);
        const fitFillClass =
          measure === "gallery" && (isFitFill || isFillFit)
            ? isFitFill
              ? index === 0
                ? styles.cellFit
                : styles.cellFill
              : index === 0
                ? styles.cellFill
                : styles.cellFit
            : "";
        return (
          <div
            key={index}
            className={`${styles.cell} ${measure === "gallery" ? styles.cellAspectMobile : ""} ${fitFillClass} ${extra ?? ""}`.trim()}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
