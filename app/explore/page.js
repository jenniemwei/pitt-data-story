import { NeighborhoodPanelProvider } from "../../src/contexts/NeighborhoodPanelContext";
import Nav from "../../src/components/nav/Nav";
import HomeMapsLayout from "../HomeMapsLayout";
import ExploreContent from "../../src/components/explore/ExploreContent";

export const metadata = {
  title: "Pittsburgh Transit Equity — Explore",
  description: "Self-explore dashboard for FY26 transit equity impacts across Pittsburgh neighborhoods.",
};

export default function ExplorePage() {
  return (
    <main className="home-full-bleed min-h-screen w-full max-w-none min-w-0 overflow-x-hidden bg-[var(--color-bg-default)] pb-24">
      <NeighborhoodPanelProvider>
        <HomeMapsLayout>
          <ExploreContent />
        </HomeMapsLayout>
      </NeighborhoodPanelProvider>
      <Nav />
    </main>
  );
}
