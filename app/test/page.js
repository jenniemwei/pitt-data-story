import { NeighborhoodPanelProvider } from "../../src/contexts/NeighborhoodPanelContext";
import CoverageMap from "../../src/components/coverage-map/CoverageMap";
import NeighborhoodRepresentationalRoutesMap from "../../src/components/route-web/RouteWeb";
import HomeMapsLayout from "../HomeMapsLayout";
import CovidRecoveryDotsComparison from "../../src/components/covid-recovery/CovidVis";
import BusRouteComparisonSection from "../../src/components/bus-route-comparison/BusRouteComparisonSection";

export default function HomePage() {
  return (
    <main className="home-full-bleed min-h-screen w-full max-w-none min-w-0 overflow-x-hidden bg-[var(--color-bg-default)] pt-6 pb-20">
      <NeighborhoodPanelProvider>
        <HomeMapsLayout>
          <CoverageMap />
          <NeighborhoodRepresentationalRoutesMap />
        </HomeMapsLayout>
      </NeighborhoodPanelProvider>
      <BusRouteComparisonSection />
      <CovidRecoveryDotsComparison />
    </main>
  );
}
