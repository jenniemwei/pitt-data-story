import Link from "next/link";
import { StoryFullExperience } from "../src/components/interactive/data-viz";

export default function HomePage() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="app-header-meta">
          <Link href="/dev">Dev playground</Link>
          <span> · isolated previews of each block</span>
        </p>
        <h1>PRT FY26 cuts: full story</h1>
        <p className="app-header-dek">
          Regional scale, two riders, FY26 cuts, a corridor compare, limits of ridership, after cuts, trip purpose, then
          the equity map.
        </p>
      </header>
      <StoryFullExperience />
    </main>
  );
}
