/**
 * Quartile binning for corridor maps (touched-hood cuts, 4 poverty bins).
 */

export function safeFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** @param {GeoJSON.Feature[]} features */
export function sortedProp(features, prop) {
  return features
    .map((f) => safeFloat(f.properties?.[prop]))
    .filter((x) => Number.isFinite(x))
    .sort((a, b) => a - b);
}

/**
 * @param {number[]} sortedVals ascending, length ≥ 1
 * @returns {[number, number, number]} upper edges for bins 0/1/2 (bin 3 is above last cut)
 */
export function quartileUpperEdges(sortedVals) {
  const n = sortedVals.length;
  if (n === 0) return [0.15, 0.35, 0.55];
  if (n === 1) {
    const v = sortedVals[0];
    return [v, v, v];
  }
  const at = (idx) => sortedVals[Math.max(0, Math.min(n - 1, Math.round(idx)))];
  const q1 = at(0.25 * (n - 1));
  const q2 = at(0.5 * (n - 1));
  const q3 = at(0.75 * (n - 1));
  return [q1, q2, q3];
}

/**
 * @param {number} v
 * @param {[number, number, number]} cuts
 */
export function binFromCuts(v, cuts) {
  const [c0, c1, c2] = cuts;
  if (c0 === c1 && c1 === c2) return 1;
  if (v <= c0) return 0;
  if (v <= c1) return 1;
  if (v <= c2) return 2;
  return 3;
}
