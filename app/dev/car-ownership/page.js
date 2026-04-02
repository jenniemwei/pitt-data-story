import { CarOwnershipChart } from "../../../src/components/interactive/data-viz";

export const metadata = {
  title: "Dev · Car ownership chart",
};

export default function DevCarOwnershipPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>
          Car ownership chart (dev)
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Loads <code>data/demographics.csv</code> via <code>/api/data</code>. Toggle{" "}
          <code>animated=&#123;false&#125;</code> in this file for print-style bars.
        </p>
      </header>
      <CarOwnershipChart />
    </main>
  );
}
