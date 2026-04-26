"use client";

import { createContext, useContext, useMemo, useState } from "react";

/** @typedef {{ neighborhood: string; lostCoverage: number; beforeCount: number; afterCount: number; beforeRoutes: string[]; afterRoutes: string[]; afterRouteItems?: { id: string; status: string }[]; profile: object | null } | null} PanelPayload */

const NeighborhoodPanelContext = createContext(null);

export function NeighborhoodPanelProvider({ children }) {
  const [coveragePanelBase, setCoveragePanelBase] = useState(/** @type {PanelPayload} */ (null));
  const [coverageSelected, setCoverageSelected] = useState(/** @type {PanelPayload} */ (null));
  const [representationalHoverPanel, setRepresentationalHoverPanel] = useState(/** @type {PanelPayload} */ (null));

  const panelDisplay = useMemo(
    () => representationalHoverPanel ?? coveragePanelBase,
    [representationalHoverPanel, coveragePanelBase],
  );

  const value = useMemo(
    () => ({
      panelDisplay,
      coverageSelected,
      setCoveragePanelBase,
      setCoverageSelected,
      setRepresentationalHoverPanel,
    }),
    [panelDisplay, coverageSelected],
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
