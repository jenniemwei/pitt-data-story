"use client";

/**
 * Small optional photo beside a journey segment or node.
 *
 * @param {{ image: { src: string; side?: 'left' | 'right'; opacity?: number } }} props
 * @param {string} [props.className]
 */
export function JourneyThumb({ image, className = "" }) {
  if (!image?.src) return null;
  return (
    <img
      src={image.src}
      alt=""
      className={className}
      style={{ opacity: image.opacity ?? 1 }}
      loading="lazy"
      decoding="async"
    />
  );
}
