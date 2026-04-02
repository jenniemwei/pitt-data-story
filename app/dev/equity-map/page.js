import { EquityMap } from "../../../src/components/interactive/data-viz";

export const metadata = {
  title: "Dev · Equity map",
};

export default function DevEquityMapPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>Equity map (dev)</h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Same component as app home; nav above for switching.
        </p>
      </header>
      <EquityMap />
    </main>
  );
}
