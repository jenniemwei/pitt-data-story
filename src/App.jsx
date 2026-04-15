import { StoryFullExperience } from "./components/data-viz/story-full-experience/StoryFullExperience";

export default function App() {
  return (
    <main className="pt-6 px-4 pb-20">
      <header className="max-w-3xl mx-auto text-left">
        <h1 className="type-story-narrative text-ink-default mb-3">PRT FY26 cuts: full story</h1>
        <p className="type-story-narrative text-ink-default mb-10">
          Regional scale, two riders, FY26 cuts, corridor map, limits of ridership framing, after cuts, and trip purpose
          proxy.
        </p>
      </header>
      <StoryFullExperience />
    </main>
  );
}
