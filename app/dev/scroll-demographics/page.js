import { ScrollDemographics } from "../../../src/components/interactive/data-viz";

export const metadata = {
  title: "Dev · Scroll demographics",
};

export default function DevScrollDemographicsPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>
          Scroll demographics (dev)
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Copy and numbers in <code>src/narrative.js</code> (<code>scrollDemographicsNarrative</code>
          ).
        </p>
      </header>
      <ScrollDemographics />
    </main>
  );
}
