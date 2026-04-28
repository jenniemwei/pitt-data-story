import GuidedStory from "../../src/components/story/GuidedStory";

export const metadata = {
  title: "Pittsburgh Transit Equity — Story",
  description:
    "A guided data story about Pittsburgh's FY26 PRT budget cuts and their unequal impact on transit-dependent neighborhoods.",
};

export default function StoryPage() {
  return (
    <main className="home-full-bleed min-h-screen w-full max-w-none min-w-0 overflow-x-hidden bg-[var(--color-bg-default)]">
      <GuidedStory />
    </main>
  );
}
