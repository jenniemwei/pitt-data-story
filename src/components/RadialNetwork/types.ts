export interface RouteStatus {
  id: string;
  label: string;
  beforeHeadway: number;
  afterHeadway: number; // 999 means eliminated
}

export interface NeighborhoodNode {
  name: string;
  bearing: number;
  ring: 0 | 1 | 2 | 3;
  poverty: number; // 0-1
  pop: number;
  routes: RouteStatus[];
}

export interface RadialNetworkProps {
  neighborhoods: NeighborhoodNode[];
  width?: number;
  height?: number;
  onSelect?: (neighborhood: NeighborhoodNode | null) => void;
}

export interface PositionedNeighborhood extends NeighborhoodNode {
  x: number;
  y: number;
  radius: number;
  color: string;
  opacity: number;
}
