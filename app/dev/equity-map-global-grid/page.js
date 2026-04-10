import EquityMap3 from "../../../src/components/data-viz/equity-map/EquityMap3";

export const metadata = {
  title: "Dev · Equity map (global grid dots)",
};

export default function DevEquityMapGlobalGridPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>Equity map — global grid dots</h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          <code>EquityMap3</code>: one rectangular lattice, point-in-polygon coloring. The original bivariate dot map
          remains <code>EquityMap2</code>.
        </p>
      </header>
      <EquityMap3 />
    </main>
  );
}
