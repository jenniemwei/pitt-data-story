import React, { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { FrequencyDotMapProps, NeighborhoodConfig, RouteConfig } from './types'
import { useDotAnimation } from './useDotAnimation'

// ── Single panel ──────────────────────────────────────────────────────────────

interface PanelProps {
  config: NeighborhoodConfig
  mapboxToken: string
  mapStyle: string
  phase: 'before' | 'after'
  transitionStart: number | null
  onToggle: () => void
  isAnimating: boolean
}

function NeighborhoodPanel({
  config,
  mapboxToken,
  mapStyle,
  phase,
  transitionStart,
  onToggle,
  isAnimating,
}: PanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Compute avg wait delta for the AFTER label
  const avgWaitDelta = React.useMemo(() => {
    const routes = config.routes.filter(r => r.after.headwayMinutes > 0 && r.after.headwayMinutes < 999)
    if (routes.length === 0) return null
    const delta = routes.reduce((sum, r) =>
      sum + (r.after.headwayMinutes - r.before.headwayMinutes), 0) / routes.length
    return Math.round(delta)
  }, [config.routes])

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return
    mapboxgl.accessToken = mapboxToken

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: mapStyle,
      bounds: config.bbox,
      fitBoundsOptions: { padding: 40 },
      interactive: true,
      attributionControl: false,
    })

    mapRef.current = map

    map.on('load', () => {
      // Add route line layers
      for (const route of config.routes) {
        const lineSourceId = `line-${route.id}`
        const dotSourceId  = `dots-${route.id}`

        // Route line
        map.addSource(lineSourceId, {
          type: 'geojson',
          data: route.geojson,
        })
        map.addLayer({
          id: `layer-line-${route.id}`,
          type: 'line',
          source: lineSourceId,
          paint: {
            'line-color': route.color,
            'line-width': 2.5,
            'line-opacity': 0.6,
          },
        })

        // Dot source — start empty, animation loop fills it
        map.addSource(dotSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })

        // Regular dots
        map.addLayer({
          id: `layer-dots-${route.id}`,
          type: 'circle',
          source: dotSourceId,
          filter: ['!=', ['get', 'ghost'], true],
          paint: {
            'circle-radius': 4,
            'circle-color': route.color,
            'circle-opacity': 0.9,
            'circle-stroke-width': 0,
          },
        })

        // Ghost dots for eliminated routes
        map.addLayer({
          id: `layer-ghost-${route.id}`,
          type: 'circle',
          source: dotSourceId,
          filter: ['==', ['get', 'ghost'], true],
          paint: {
            'circle-radius': 4,
            'circle-color': '#555555',
            'circle-opacity': 0.35,
          },
        })
      }

      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [config, mapboxToken, mapStyle])

  // Update dot opacity when phase changes (faded in AFTER state)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const opacity = phase === 'after' ? 0.5 : 0.9
    for (const route of config.routes) {
      if (map.getLayer(`layer-dots-${route.id}`)) {
        map.setPaintProperty(`layer-dots-${route.id}`, 'circle-opacity', opacity)
      }
    }
  }, [phase, mapReady, config.routes])

  // Run animation loop
  useDotAnimation({
    map: mapRef.current,
    routes: config.routes,
    phase,
    transitionStart,
    enabled: mapReady,
  })

  return (
    <div style={styles.panel}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.neighborhoodLabel}>{config.name}</span>
        <div style={styles.toggleGroup}>
          <button
            style={{ ...styles.toggleBtn, ...(phase === 'before' ? styles.toggleActive : {}) }}
            onClick={phase !== 'before' ? onToggle : undefined}
            disabled={isAnimating}
          >
            Before
          </button>
          <button
            style={{ ...styles.toggleBtn, ...(phase === 'after' ? styles.toggleActiveAfter : {}) }}
            onClick={phase !== 'after' ? onToggle : undefined}
            disabled={isAnimating}
          >
            After
          </button>
        </div>
        {phase === 'after' && avgWaitDelta !== null && avgWaitDelta > 0 && (
          <span style={styles.deltaLabel}>+{avgWaitDelta} min avg wait</span>
        )}
      </div>

      {/* Map */}
      <div ref={containerRef} style={styles.mapContainer} />

      {/* Legend */}
      <div style={styles.legend}>
        <LegendRow label="Frequent" spacing={6} color="#ffffff" />
        <LegendRow label="Infrequent" spacing={18} color="#ffffff" />
        <LegendRow label="Eliminated" spacing={0} color="#555555" ghost />
      </div>
    </div>
  )
}

function LegendRow({
  label,
  spacing,
  color,
  ghost = false,
}: {
  label: string
  spacing: number
  color: string
  ghost?: boolean
}) {
  const dots = ghost ? [0] : [0, spacing, spacing * 2].filter(x => x <= 44)
  return (
    <div style={styles.legendRow}>
      <svg width={48} height={10} style={{ flexShrink: 0 }}>
        <line x1={0} y1={5} x2={48} y2={5} stroke="#444" strokeWidth={1.5} />
        {dots.map((x, i) => (
          <circle key={i} cx={ghost ? 24 : x + 4} cy={5} r={3.5}
            fill={color} opacity={ghost ? 0.35 : 0.9} />
        ))}
      </svg>
      <span style={styles.legendLabel}>{label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function FrequencyDotMap({
  mapboxToken,
  neighborhoods,
  mapStyle = 'mapbox://styles/mapbox/dark-v11',
}: FrequencyDotMapProps) {
  // Each panel has its own phase state so they can be toggled independently,
  // but the global "play" button fires both simultaneously.
  const [phases, setPhases] = useState<['before' | 'after', 'before' | 'after']>(['before', 'before'])
  const [transitionStarts, setTransitionStarts] = useState<[number | null, number | null]>([null, null])
  const [isAnimating, setIsAnimating] = useState(false)

  const togglePanel = useCallback((idx: 0 | 1) => {
    const now = performance.now()
    setPhases(prev => {
      const next = [...prev] as typeof prev
      next[idx] = prev[idx] === 'before' ? 'after' : 'before'
      return next
    })
    setTransitionStarts(prev => {
      const next = [...prev] as typeof prev
      next[idx] = now
      return next
    })
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 1600)
  }, [])

  const playBoth = useCallback(() => {
    const now = performance.now()
    const targetPhase = phases[0] === 'before' ? 'after' : 'before'
    setPhases([targetPhase, targetPhase])
    setTransitionStarts([now, now])
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 1600)
  }, [phases])

  const allAfter = phases[0] === 'after' && phases[1] === 'after'

  return (
    <div style={styles.root}>
      {/* Global controls */}
      <div style={styles.globalControls}>
        <button style={styles.playBtn} onClick={playBoth} disabled={isAnimating}>
          {allAfter ? '↩ Reset to Before' : '▶ Show Impact'}
        </button>
        <span style={styles.globalHint}>
          Dot spacing = headway · same speed, wider gaps = longer waits
        </span>
      </div>

      {/* Two panels */}
      <div style={styles.panels}>
        {neighborhoods.map((config, i) => (
          <NeighborhoodPanel
            key={config.name}
            config={config}
            mapboxToken={mapboxToken}
            mapStyle={mapStyle}
            phase={phases[i as 0 | 1]}
            transitionStart={transitionStarts[i as 0 | 1]}
            onToggle={() => togglePanel(i as 0 | 1)}
            isAnimating={isAnimating}
          />
        ))}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    fontFamily: "'DM Mono', 'Courier New', monospace",
    background: '#0d0d0d',
    padding: '16px',
    borderRadius: '8px',
    height: '100%',
    boxSizing: 'border-box',
  },
  globalControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  playBtn: {
    background: '#BB3C10',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 18px',
    fontFamily: 'inherit',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.03em',
    transition: 'opacity 0.2s',
  },
  globalHint: {
    color: '#666',
    fontSize: '11px',
    letterSpacing: '0.04em',
  },
  panels: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    flex: 1,
    minHeight: 0,
  },
  panel: {
    display: 'flex',
    flexDirection: 'column',
    background: '#161616',
    borderRadius: '6px',
    overflow: 'hidden',
    border: '1px solid #2a2a2a',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  neighborhoodLabel: {
    color: '#e8e4dc',
    fontSize: '13px',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    flex: 1,
  },
  toggleGroup: {
    display: 'flex',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #333',
  },
  toggleBtn: {
    background: 'transparent',
    color: '#666',
    border: 'none',
    padding: '4px 12px',
    fontFamily: "'DM Mono', 'Courier New', monospace",
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    transition: 'all 0.15s',
  },
  toggleActive: {
    background: '#2a2a2a',
    color: '#1D9E75',
  },
  toggleActiveAfter: {
    background: '#2a2a2a',
    color: '#BB3C10',
  },
  deltaLabel: {
    color: '#BB3C10',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.04em',
  },
  mapContainer: {
    flex: 1,
    minHeight: 0,
  },
  legend: {
    display: 'flex',
    gap: '16px',
    padding: '8px 14px',
    background: '#111',
    borderTop: '1px solid #222',
    flexShrink: 0,
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendLabel: {
    color: '#555',
    fontSize: '10px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
}

export default FrequencyDotMap
