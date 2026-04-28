/** Ease in-out cubic */
export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Given a transition start timestamp and current time,
 * returns the interpolated headway between before and after values.
 * Returns null if transition not started.
 */
export function interpolateHeadway(
  beforeMinutes: number,
  afterMinutes: number,
  transitionStart: number | null,
  now: number,
  durationMs = 1500
): number {
  if (transitionStart === null) return beforeMinutes
  const raw = Math.min((now - transitionStart) / durationMs, 1)
  const t = easeInOut(raw)
  return lerp(beforeMinutes, afterMinutes, t)
}

/** True once transition is complete */
export function isTransitionDone(
  transitionStart: number | null,
  now: number,
  durationMs = 1500
): boolean {
  if (transitionStart === null) return false
  return now - transitionStart >= durationMs
}
