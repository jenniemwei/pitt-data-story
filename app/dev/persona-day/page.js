import { PersonaDayCard } from "../../../src/components/interactive/data-viz";

export const metadata = {
  title: "Dev · Persona day cards",
};

export default function DevPersonaDayPage() {
  return (
    <main>
      <header className="app-header" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ fontSize: "1.25rem", margin: "0 0 var(--space-2)" }}>
          Persona journeys (dev)
        </h1>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>
          Vertical spacing ∝ minutes on each leg. After column shows deltas vs before. Copy in{" "}
          <code>src/narrative.js</code>.
        </p>
      </header>
      <PersonaDayCard phase="before" showSectionHeading />
      <hr style={{ margin: "2rem 0", border: 0, borderTop: "1px solid var(--color-border-default)" }} />
      <PersonaDayCard phase="after" showSectionHeading />
    </main>
  );
}
