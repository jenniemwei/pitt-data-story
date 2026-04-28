import type { FeatureCollection } from 'geojson'

export interface RouteConfig {
  id: string
  label: string
  color: string
  geojson: FeatureCollection
  before: { headwayMinutes: number }
  after: { headwayMinutes: number }
}

export interface NeighborhoodConfig {
  name: string
  bbox: [number, number, number, number]
  routes: RouteConfig[]
}

export interface FrequencyDotMapProps {
  mapboxToken: string
  neighborhoods: [NeighborhoodConfig, NeighborhoodConfig]
  mapStyle?: string
}

export interface AnimationState {
  elapsed: number
  headways: Record<string, number>   // routeId → current interpolated headway
  phase: 'before' | 'transitioning' | 'after'
  transitionStart: number | null
}
