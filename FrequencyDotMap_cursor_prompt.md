# Cursor Prompt — FrequencyDotMap Component

Create a React component called `FrequencyDotMap` that visualizes transit route
frequency as animated moving dots on Mapbox GL JS route lines.

## Core visual concept

Dots travel along route lines at a constant speed. The spacing between dots
encodes headway — frequent routes have closely spaced dots, infrequent routes
have wide gaps. The viewer perceives frequency without reading any number.
Dot speed never changes between before/after states — only spacing changes.

## Props

```ts
interface FrequencyDotMapProps {
  mapboxToken: string

  neighborhoods: [NeighborhoodConfig, NeighborhoodConfig]  // exactly two

  // Mapbox style to use as base
  mapStyle?: string  // default: 'mapbox://styles/mapbox/dark-v11'
}

interface NeighborhoodConfig {
  name: string           // display label e.g. "Larimer"
  bbox: [number, number, number, number]  // [minLng, minLat, maxLng, maxLat]
  routes: RouteConfig[]
}

interface RouteConfig {
  id: string             // e.g. "86"
  label: string          // e.g. "Route 86"
  color: string          // hex color for this route line
  geojson: GeoJSON.FeatureCollection  // LineString geometry of the route
  before: { headwayMinutes: number }  // e.g. 15
  after:  { headwayMinutes: number }  // e.g. 60
}
```

## Layout

Split view: two map panels side by side, one per neighborhood.
Each panel has a BEFORE and AFTER toggle at the top — default shows BEFORE,
click AFTER to switch to post-cut state. Or add a global play button that
animates the transition across both panels simultaneously.

Each panel shows:
- Neighborhood name as a label overlay (top left)
- Route lines with animated dots
- A small legend: dot cluster = frequent, sparse dots = infrequent

## Animation implementation

Use `requestAnimationFrame` to drive all dot positions.

For each route:
```
dotSpeed = 0.003  // constant — same before and after, units = fraction of
                  //  route length per frame at 60fps

headwayFraction = (headwayMinutes / 60) * dotSpeed * 3600
                  // converts headway to spacing as fraction of route length

numDots = Math.ceil(1 / headwayFraction)
          // how many dots needed to fill the route

dotPositions[i] = (offset + i * headwayFraction + elapsed * dotSpeed) % 1
                  // offset staggers dots evenly; elapsed drives movement
```

Use `turf.along` and `turf.length` to convert fraction → [lng, lat] for
each dot position. Render dots as Mapbox GL `symbol` or `circle` layers,
updating `getSource('dots-[routeId]').setData(...)` each frame.

## Transition between before/after

When toggling BEFORE → AFTER:
- Do NOT cut instantly. Animate headway over 1.5 seconds using easing.
- Dots smoothly spread apart (or compress) as headway interpolates.
- `currentHeadway = lerp(before.headwayMinutes, after.headwayMinutes, t)`
  where `t` goes 0→1 over 1500ms with ease-in-out.

## Dot styling

```
before state:
  circle-radius: 4
  circle-color: route.color
  circle-opacity: 0.9

after state:
  circle-radius: 4
  circle-color: route.color
  circle-opacity: 0.5   // slightly faded — service is diminished

eliminated routes (after.headwayMinutes === Infinity or 0):
  show 1 ghost dot, static, at route midpoint
  circle-color: '#555'
  circle-opacity: 0.3
```

## Panel header

Each panel header shows:
- Neighborhood name (large)
- BEFORE / AFTER tab toggle
- On AFTER: show delta label e.g. "+45 min avg wait" in coral/amber

## File structure

```
components/
  FrequencyDotMap/
    index.tsx          ← main component, map init, panel layout
    useDotAnimation.ts ← requestAnimationFrame loop, position math
    interpolateHeadway.ts ← lerp + easing for before→after transition
    types.ts           ← all shared types
```

## Dependencies

- mapbox-gl
- @turf/turf
- react (hooks only, no class components)

## Notes

- Initialize two separate Mapbox map instances, one per panel ref.
- Add route lines as `line` layers before starting the dot animation loop.
- Clean up `cancelAnimationFrame` and `map.remove()` in useEffect cleanup.
- The component should work without any server — all data passed via props.
- Do not hardcode any Pittsburgh-specific data; keep it fully generic via props.
