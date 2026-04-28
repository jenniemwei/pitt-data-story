import GuidedStory from "../src/components/story/GuidedStory";
import Nav from "../src/components/nav/Nav";

export const metadata = {
  title: "Pittsburgh Transit Equity — Story",
  description:
    "A guided data story about Pittsburgh's FY26 PRT budget cuts and their unequal impact on transit-dependent neighborhoods.",
};

export default function StoryPage() {
  return (
    <main className="story-dark home-full-bleed min-h-screen w-full max-w-none min-w-0 overflow-x-hidden bg-[var(--n6)] pb-24">
      <GuidedStory />
      <Nav />
    </main>
  );
}
