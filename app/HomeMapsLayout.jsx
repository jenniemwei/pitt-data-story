"use client";

import NeighborhoodInfoPanel from "../src/components/info-panel/InfoPanel";
import homeStyles from "./home-maps.module.css";

const PANEL_WIDTH = "clamp(280px, 34vw, 440px)";

export default function HomeMapsLayout({ children }) {
  return (
    <div className={homeStyles.grid} style={{ "--home-info-panel-width": PANEL_WIDTH }}>
      <div className={homeStyles.stickyPanelWrap}>
        <NeighborhoodInfoPanel />
      </div>
      <div className={homeStyles.mapsColumn}>{children}</div>
    </div>
  );
}
