import { StoryFullExperience } from "./components/data-viz/story-full-experience/StoryFullExperience";

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>PRT FY26 cuts: full story</h1>
        <p className="app-header-dek">
          Regional scale, two riders, FY26 cuts, corridor map, limits of ridership framing, after cuts, and trip purpose
          proxy.
        </p>
      </header>
      <StoryFullExperience />
    </main>
  );
}
