"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

/** @typedef {{ neighborhood: string; lostCoverage: number; beforeCount: number; afterCount: number; beforeRoutes: string[]; afterRoutes: string[]; profile: object | null } | null} PanelPayload */

const NeighborhoodPanelContext = createContext(null);

export function NeighborhoodPanelProvider({ children }) {
  const [coveragePanelBase, setCoveragePanelBase] = useState(/** @type {PanelPayload} */ (null));
  const [coverageSelected, setCoverageSelected] = useState(/** @type {PanelPayload} */ (null));
  const [representationalHoverPanel, setRepresentationalHoverPanel] = useState(/** @type {PanelPayload} */ (null));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const clearCoverageSelectionRef = useRef(() => {});

  const panelDisplay = useMemo(
    () => representationalHoverPanel ?? coveragePanelBase,
    [representationalHoverPanel, coveragePanelBase],
  );

  const registerClearCoverageSelection = useCallback((fn) => {
    clearCoverageSelectionRef.current = typeof fn === "function" ? fn : () => {};
  }, []);

  const clearCoverageSelection = useCallback(() => {
    clearCoverageSelectionRef.current();
  }, []);

  const value = useMemo(
    () => ({
      panelDisplay,
      coverageSelected,
      sidebarCollapsed,
      setSidebarCollapsed,
      setCoveragePanelBase,
      setCoverageSelected,
      setRepresentationalHoverPanel,
      registerClearCoverageSelection,
      clearCoverageSelection,
    }),
    [
      panelDisplay,
      coverageSelected,
      sidebarCollapsed,
      registerClearCoverageSelection,
      clearCoverageSelection,
    ],
  );

  return <NeighborhoodPanelContext.Provider value={value}>{children}</NeighborhoodPanelContext.Provider>;
}

export function useNeighborhoodPanel() {
  const ctx = useContext(NeighborhoodPanelContext);
  if (!ctx) {
    throw new Error("useNeighborhoodPanel must be used within NeighborhoodPanelProvider");
  }
  return ctx;
}
