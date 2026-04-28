import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import * as turf from '@turf/turf'
import type { RouteConfig } from './types'
import { interpolateHeadway, isTransitionDone } from './interpolateHeadway'

/**
 * Constant dot travel speed — fraction of route length per millisecond.
 * At 60fps (16.67ms/frame) a dot moves ~0.005% of the route per frame.
 * Adjust to taste; this gives roughly 30s to traverse a 1km route.
 */
const DOT_SPEED = 0.00003  // fraction of route length per ms

/**
 * Convert headway (minutes) to spacing between dots as a fraction of route length.
 * headway=15 min at DOT_SPEED means a dot takes ~555ms to travel 1% of route,
 * so 60 frames × 0.003 ≈ 1 unit per ~33s → headway fraction ≈ headway × DOT_SPEED × 60000
 */
function headwayToSpacing(headwayMinutes: number): number {
  // spacing = time_between_buses_ms × speed_per_ms
  return headwayMinutes * 60_000 * DOT_SPEED
}

function buildDotGeoJSON(
  routeGeojson: RouteConfig['geojson'],
  headwayMinutes: number,
  elapsed: number,
  routeOffset: number   // per-route phase offset so all routes don't sync
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = []

  // Eliminated route — single ghost dot at midpoint
  if (!headwayMinutes || headwayMinutes >= 999) {
    const line = routeGeojson.features.find(f => f.geometry.type === 'LineString')
    if (line) {
      const len = turf.length(line as turf.Feature<turf.LineString>, { units: 'kilometers' })
      const pt = turf.along(line as turf.Feature<turf.LineString>, len / 2, { units: 'kilometers' })
      pt.properties = { ghost: true }
      features.push(pt)
    }
    return { type: 'FeatureCollection', features }
  }

  const spacing = headwayToSpacing(headwayMinutes)  // fraction of route length
  const numDots = Math.max(1, Math.ceil(1 / spacing))

  for (const feature of routeGeojson.features) {
    if (feature.geometry.type !== 'LineString') continue
    const line = feature as turf.Feature<turf.LineString>
    const totalKm = turf.length(line, { units: 'kilometers' })
    if (totalKm === 0) continue

    for (let i = 0; i < numDots; i++) {
      // Each dot starts at an evenly spaced offset, then advances by elapsed
      const fraction = ((routeOffset + i * spacing + elapsed * DOT_SPEED) % 1 + 1) % 1
      const distKm = fraction * totalKm
      try {
        const pt = turf.along(line, distKm, { units: 'kilometers' })
        pt.properties = { ghost: false }
        features.push(pt)
      } catch {
        // turf.along can throw for degenerate geometries — skip
      }
    }
  }

  return { type: 'FeatureCollection', features }
}

interface UseDotAnimationParams {
  map: mapboxgl.Map | null
  routes: RouteConfig[]
  phase: 'before' | 'after'
  transitionStart: number | null
  enabled: boolean
}

export function useDotAnimation({
  map,
  routes,
  phase,
  transitionStart,
  enabled,
}: UseDotAnimationParams) {
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  // Stable per-route offsets so dots don't all start at position 0
  const offsetsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    if (!map || !enabled) return

    // Assign stable offsets once per route
    for (const route of routes) {
      if (offsetsRef.current[route.id] === undefined) {
        offsetsRef.current[route.id] = Math.random()
      }
    }

    function frame(now: number) {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current

      for (const route of routes) {
        const headway = interpolateHeadway(
          route.before.headwayMinutes,
          route.after.headwayMinutes,
          phase === 'before' ? null : transitionStart,
          now
        )

        const geojson = buildDotGeoJSON(
          route.geojson,
          headway,
          elapsed,
          offsetsRef.current[route.id] ?? 0
        )

        const sourceId = `dots-${route.id}`
        const src = map!.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined
        if (src) {
          src.setData(geojson)
        }
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [map, routes, phase, transitionStart, enabled])
}
