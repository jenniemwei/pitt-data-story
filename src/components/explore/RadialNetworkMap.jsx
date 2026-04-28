"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./RadialNetworkMap.module.css";

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function povertyColor(povertyShare) {
  const p = Number(povertyShare) || 0;
  if (p > 0.35) return "#D85A30";
  if (p > 0.2) return "#EF9F27";
  return "#8DB07A";
}

export default function RadialNetworkMap({
  nodes,
  selectedNeighborhoods,
  onToggleNeighborhood,
}) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });
  const layoutRef = useRef([]);

  const selectedSet = useMemo(() => new Set(selectedNeighborhoods), [selectedNeighborhoods]);
  const hoveredName = hovered?.name || null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = Math.max(wrap.clientHeight, 520);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = w / 2;
    const cy = h / 2;

    const maxPop = Math.max(
      1,
      ...nodes.map((n) => Number(n.population) || 0),
    );

    const nonDowntown = nodes.filter((n) => !n.isDowntown);
    const distances = nonDowntown.map((n) => Number(n.distanceKm) || 0).sort((a, b) => a - b);
    const q1 = distances[Math.floor(distances.length * 0.33)] || 2;
    const q2 = distances[Math.floor(distances.length * 0.66)] || 5;
    const ringForDistance = (d) => (d <= q1 ? 1 : d <= q2 ? 2 : 3);
    const ringRadius = { 1: Math.min(w, h) * 0.2, 2: Math.min(w, h) * 0.31, 3: Math.min(w, h) * 0.42 };

    const laidOut = nodes.map((n) => {
      if (n.isDowntown) {
        return { ...n, x: cx, y: cy, r: 18 };
      }
      const ring = ringForDistance(Number(n.distanceKm) || 0);
      const bearing = (Number(n.bearingDeg) || 0) * (Math.PI / 180);
      const rr = ringRadius[ring] || ringRadius[3];
      const x = cx + Math.cos(bearing) * rr;
      const y = cy + Math.sin(bearing) * rr;
      const r = 5 + (Math.sqrt(Math.max(0, Number(n.population) || 0) / maxPop) * 28);
      return { ...n, x, y, r };
    });
    layoutRef.current = laidOut;

    ctx.clearRect(0, 0, w, h);

    const anySelected = selectedSet.size > 0;
    const activeName = hoveredName || selectedNeighborhoods[0] || null;
    const activeNode = activeName ? laidOut.find((n) => n.name === activeName) : null;
    const activeRoutes = new Set(activeNode?.routesBefore || []);

    for (const n of laidOut) {
      if (n.isDowntown) continue;
      const thisRoutes = n.routesBefore || [];
      const hasActiveRoute = thisRoutes.some((r) => activeRoutes.has(r));
      let opacity = 0.25;
      let width = 1;
      if (anySelected) {
        opacity = n.name === activeName || hasActiveRoute ? 1 : 0.06;
        width = n.name === activeName || hasActiveRoute ? 2 : 1;
      }
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(n.x, n.y);
      ctx.strokeStyle = `rgba(30, 70, 85, ${opacity})`;
      ctx.lineWidth = width;
      ctx.stroke();
    }

    for (const n of laidOut) {
      const isSel = selectedSet.has(n.name);
      const isHover = hoveredName === n.name;
      const opacity = n.isDowntown ? 1 : Math.max(0.25, Math.min(0.95, Number(n.povertyShare) || 0));
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.isDowntown ? "#134948" : povertyColor(n.povertyShare);
      ctx.globalAlpha = opacity;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (isSel || isHover) {
        ctx.lineWidth = isSel ? 3 : 2;
        ctx.strokeStyle = "#0b1012";
        ctx.stroke();
      }
    }
  }, [nodes, selectedNeighborhoods, selectedSet, hoveredName]);

  const getHit = (clientX, clientY) => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const p = { x: clientX - rect.left, y: clientY - rect.top };
    let best = null;
    let bestD = Infinity;
    for (const n of layoutRef.current) {
      const d = dist2(p, n);
      if (d <= n.r * n.r && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  };

  return (
    <div
      ref={wrapRef}
      className={styles.root}
      onMouseMove={(e) => {
        const hit = getHit(e.clientX, e.clientY);
        setHovered(hit ? { name: hit.name } : null);
        setTip({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      }}
      onMouseLeave={() => setHovered(null)}
      onClick={(e) => {
        const hit = getHit(e.clientX, e.clientY);
        if (!hit || hit.isDowntown) return;
        onToggleNeighborhood(hit.name, Boolean(e.shiftKey));
      }}
      role="img"
      aria-label="Radial neighborhood network map"
    >
      <canvas ref={canvasRef} className={styles.canvas} />
      {hovered ? (
        <div className={`${styles.tooltip} type-data-label`} style={{ left: tip.x, top: tip.y }}>
          {hovered.name}
        </div>
      ) : null}
    </div>
  );
}
