import { NeighborhoodPanelProvider } from "../src/contexts/NeighborhoodPanelContext";
import CoverageMap from "../src/components/data-viz/coverage-map/CoverageMap";
import NeighborhoodRepresentationalRoutesMap from "../src/components/data-viz/neighborhood-representational-routes-map/NeighborhoodRepresentationalRoutesMap";
import HomeMapsLayout from "./HomeMapsLayout";

export default function HomePage() {
  return (
    <main className="home-full-bleed min-h-screen w-full max-w-none min-w-0 overflow-x-hidden pt-6 pb-20">
      <NeighborhoodPanelProvider>
        <HomeMapsLayout>
          <CoverageMap />
          <NeighborhoodRepresentationalRoutesMap />
        </HomeMapsLayout>
      </NeighborhoodPanelProvider>
    </main>
  );
}
