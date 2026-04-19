import { StoryFullExperience } from "../src/components/data-viz";
import { GalleryRow } from "../src/components/layout/GalleryRow";
import { homePageStructure } from "../src/data/structure";

export default function HomePage() {
  return (
    <main className="pt-6 px-4 pb-20">
      <GalleryRow
        variant={homePageStructure.introRow.variant}
        measure={homePageStructure.introRow.measure}
        layoutId={homePageStructure.introRow.id}
        className="max-w-3xl mx-auto w-full"
      >
        <header className="text-left">
          <h1 className="type-story-narrative text-ink-default mb-3">PRT FY26 cuts: full story</h1>
          <p className="type-story-narrative text-ink-default mb-10">
            Regional scale, two riders, FY26 cuts, corridor map, limits of ridership framing, after cuts, and trip
            purpose proxy.
          </p>
        </header>
      </GalleryRow>
      <StoryFullExperience />
    </main>
  );
}
