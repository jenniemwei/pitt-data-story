import Link from "next/link";
import { ScrollDemographics } from "../../src/components/data-viz/scroll-demographics/ScrollDemographics";
import { demographicsPageStructure } from "../../src/data/structure";

export const metadata = {
  title: "Demographics scroll · PRT FY26 cuts",
  description: "Scroll narrative comparing 71B and P10 corridors by ridership, poverty, and transit commute proxy.",
};

export default function DemographicsSectionPage() {
  return (
    <main className="pt-6 px-4 pb-20">
      <div
        className="max-w-3xl mx-auto w-full mb-8"
        data-layout-id={demographicsPageStructure.navRow.id}
      >
        <Link href="/" className="type-link-back text-ink-default underline-offset-4 hover:underline">
          ← Back home
        </Link>
      </div>
      <div className="w-full max-w-[72rem] mx-auto" data-layout-id={demographicsPageStructure.bodyRow.id}>
        <ScrollDemographics />
      </div>
    </main>
  );
}
