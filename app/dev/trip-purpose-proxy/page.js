import { TripPurposeProxy } from "../../../src/components/data-viz";

export const metadata = {
  title: "Dev · Trip purpose proxy",
};

export default function DevTripPurposeProxyPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>
          Trip purpose proxy (dev)
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Scene 02 or 06 — stacked industry mix as a proxy for why people ride. Swap in LEHD or ACS
          data via <code>routeEmployment</code> prop.
        </p>
      </header>
      <TripPurposeProxy />
    </main>
  );
}
