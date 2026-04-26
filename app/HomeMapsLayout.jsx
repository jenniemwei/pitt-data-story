"use client";

import { useNeighborhoodPanel } from "../src/contexts/NeighborhoodPanelContext";
import NeighborhoodInfoPanel from "../src/components/neighborhood-panel/NeighborhoodInfoPanel";
import homeStyles from "./home-maps.module.css";

export default function HomeMapsLayout({ children }) {
  const { sidebarCollapsed } = useNeighborhoodPanel();
  const panelWidth = sidebarCollapsed ? "0px" : "clamp(280px, 34vw, 440px)";

  return (
    <div
      className={`${homeStyles.grid} ${sidebarCollapsed ? homeStyles.gridCollapsed : ""}`}
      style={{ "--home-info-panel-width": panelWidth }}
    >
      <div className={homeStyles.stickyPanelWrap}>
        <NeighborhoodInfoPanel />
      </div>
      <div className={homeStyles.mapsColumn}>{children}</div>
    </div>
  );
}
