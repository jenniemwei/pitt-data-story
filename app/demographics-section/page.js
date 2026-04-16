import Link from "next/link";
import { ScrollDemographics } from "../../src/components/data-viz";

export const metadata = {
  title: "Demographics scroll · PRT FY26 cuts",
  description: "Scroll narrative comparing 71B and P10 corridors by ridership, poverty, and transit commute proxy.",
};

export default function DemographicsSectionPage() {
  return (
    <main className="pt-6 px-4 pb-20">
      <div className="max-w-3xl mx-auto mb-8">
        <Link href="/" className="type-link-back text-ink-default underline-offset-4 hover:underline">
          ← Back to full story
        </Link>
      </div>
      <ScrollDemographics />
    </main>
  );
}
