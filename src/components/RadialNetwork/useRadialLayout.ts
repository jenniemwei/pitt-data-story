import type { NeighborhoodNode, PositionedNeighborhood } from "./types";

const RING_FACTORS: Record<0 | 1 | 2 | 3, number> = {
  0: 0,
  1: 0.28,
  2: 0.45,
  3: 0.62,
};

function nodeColor(poverty: number): string {
  if (poverty > 0.35) return "#D85A30";
  if (poverty > 0.2) return "#EF9F27";
  return "#A8C090";
}

function nodeOpacity(poverty: number): number {
  return 0.25 + poverty * 0.65;
}

export function buildRadialLayout(
  neighborhoods: NeighborhoodNode[],
  width: number,
  height: number,
): PositionedNeighborhood[] {
  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) / 2;
  const maxPop = Math.max(1, ...neighborhoods.map((n) => n.pop || 0));

  return neighborhoods.map((node) => {
    const ringRadius = baseRadius * (RING_FACTORS[node.ring] ?? 0.45);
    const angle = (node.bearing * Math.PI) / 180;
    const x = cx + ringRadius * Math.cos(angle);
    const y = cy + ringRadius * Math.sin(angle);
    const radius = 12 + (node.pop / maxPop) * 40;

    return {
      ...node,
      x,
      y,
      radius,
      color: nodeColor(node.poverty),
      opacity: nodeOpacity(node.poverty),
    };
  });
}
