"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildRadialLayout } from "./useRadialLayout";
import styles from "./index.module.css";
import type { NeighborhoodNode, PositionedNeighborhood, RadialNetworkProps, RouteStatus } from "./types";

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x1 - x2, y1 - y2);
}

function routeResult(route: RouteStatus): { label: string; className: string } {
  if (route.afterHeadway >= 999) return { label: "— eliminated", className: styles.elim };
  if (route.afterHeadway > route.beforeHeadway) return { label: `↓ ${route.afterHeadway} min`, className: styles.reduce };
  return { label: "✓ kept", className: styles.keep };
}

function routeColor(poverty: number): string {
  if (poverty > 0.35) return "#D85A30";
  if (poverty > 0.2) return "#EF9F27";
  return "#A8C090";
}

function drawNetwork(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  nodes: PositionedNeighborhood[],
  selected: string | null,
  hovered: string | null,
) {
  const cx = width / 2;
  const cy = height / 2;
  ctx.clearRect(0, 0, width, height);

  const selectedNode = selected ? nodes.find((n) => n.name === selected) : null;
  const hoveredNode = hovered ? nodes.find((n) => n.name === hovered) : null;

  // Lines first
  for (const node of nodes) {
    if (node.name === "Downtown") continue;
    const color = routeColor(node.poverty);

    let opacity = 0.3;
    let lineWidth = 1;

    if (selectedNode) {
      if (selectedNode.name === node.name) {
        opacity = 1;
        lineWidth = 2;
      } else {
        opacity = 0.06;
      }
    } else if (hoveredNode && hoveredNode.name === node.name) {
      opacity = 0.6;
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(node.x, node.y);
    ctx.strokeStyle = color;
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Nodes on top
  for (const node of nodes) {
    const isSelected = selected === node.name;
    const isHovered = hovered === node.name;

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.2;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.globalAlpha = node.opacity;
    ctx.fill();
    ctx.globalAlpha = 1;

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    if (isSelected || isHovered) {
      ctx.fillStyle = "#121212";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.name, node.x, node.y + node.radius + 14);
    }
  }
}

export default function RadialNetwork({
  neighborhoods,
  width = 680,
  height = 560,
  onSelect,
}: RadialNetworkProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [measuredWidth, setMeasuredWidth] = useState(width);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  const resolvedWidth = measuredWidth || width;
  const resolvedHeight = Math.round((height / width) * resolvedWidth);

  const positioned = useMemo(
    () => buildRadialLayout(neighborhoods, resolvedWidth, resolvedHeight),
    [neighborhoods, resolvedWidth, resolvedHeight],
  );

  const selectedNode = selectedName ? positioned.find((n) => n.name === selectedName) ?? null : null;

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0]?.contentRect?.width || width);
      if (next > 0) setMeasuredWidth(next);
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [width]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(resolvedWidth * dpr);
    canvas.height = Math.round(resolvedHeight * dpr);
    canvas.style.width = `${resolvedWidth}px`;
    canvas.style.height = `${resolvedHeight}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    drawNetwork(ctx, resolvedWidth, resolvedHeight, positioned, selectedName, hoveredName);
  }, [resolvedWidth, resolvedHeight, positioned, selectedName, hoveredName]);

  function hitNode(clientX: number, clientY: number): PositionedNeighborhood | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    for (let i = positioned.length - 1; i >= 0; i -= 1) {
      const node = positioned[i];
      if (distance(x, y, node.x, node.y) <= node.radius) return node;
    }
    return null;
  }

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const hit = hitNode(e.clientX, e.clientY);
    const next = hit ? (selectedName === hit.name ? null : hit.name) : null;
    setSelectedName(next);
    onSelect?.(next ? neighborhoods.find((n) => n.name === next) ?? null : null);
  }

  function onCanvasMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const hit = hitNode(e.clientX, e.clientY);
    const canvas = canvasRef.current;

    if (hit) {
      setHoveredName(hit.name);
      setTooltip({ x: e.clientX, y: e.clientY, text: hit.name });
      if (canvas) canvas.style.cursor = "pointer";
    } else {
      setHoveredName(null);
      setTooltip(null);
      if (canvas) canvas.style.cursor = "default";
    }
  }

  function onCanvasLeave() {
    setHoveredName(null);
    setTooltip(null);
    if (canvasRef.current) canvasRef.current.style.cursor = "default";
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <div className={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          onClick={onCanvasClick}
          onMouseMove={onCanvasMove}
          onMouseLeave={onCanvasLeave}
          aria-label="Radial neighborhood transit network"
          role="img"
        />
        {tooltip ? (
          <div className={`${styles.tooltip} type-data-label`} style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.text}
          </div>
        ) : null}
      </div>

      {selectedNode ? (
        <aside className={styles.panel} aria-live="polite">
          <h3 className={`${styles.panelTitle} type-h3 text-ink-default`}>{selectedNode.name}</h3>
          <p className={`${styles.panelStat} type-body-sm text-ink-secondary`}>
            Population: {selectedNode.pop.toLocaleString()}
          </p>
          <p className={`${styles.panelStat} type-body-sm text-ink-secondary`}>
            Poverty rate: {(selectedNode.poverty * 100).toFixed(1)}%
          </p>
          <p className={`${styles.panelStat} type-body-sm text-ink-secondary`}>
            Routes served: {selectedNode.routes.map((r) => r.id).join(", ") || "None"}
          </p>

          <table className={`${styles.routeTable} type-data-label`}>
            <thead>
              <tr>
                <th>Route</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {selectedNode.routes.map((r) => {
                const result = routeResult(r);
                return (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.beforeHeadway} min</td>
                    <td className={result.className}>{result.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </aside>
      ) : null}
    </div>
  );
}
