import Link from "next/link";
import { ScrollDemographics } from "../../src/components/data-viz/scroll-demographics/ScrollDemographics";
import { GalleryRow } from "../../src/components/layout/GalleryRow";
import { demographicsPageStructure } from "../../src/data/structure";

export const metadata = {
  title: "Demographics scroll · PRT FY26 cuts",
  description: "Scroll narrative comparing 71B and P10 corridors by ridership, poverty, and transit commute proxy.",
};

export default function DemographicsSectionPage() {
  return (
    <main className="pt-6 px-4 pb-20">
      <GalleryRow
        variant={demographicsPageStructure.navRow.variant}
        measure={demographicsPageStructure.navRow.measure}
        layoutId={demographicsPageStructure.navRow.id}
        className="max-w-3xl mx-auto w-full mb-8"
      >
        <div>
          <Link href="/" className="type-link-back text-ink-default underline-offset-4 hover:underline">
            ← Back home
          </Link>
        </div>
      </GalleryRow>
      <GalleryRow
        variant={demographicsPageStructure.bodyRow.variant}
        measure={demographicsPageStructure.bodyRow.measure}
        layoutId={demographicsPageStructure.bodyRow.id}
        className="w-full max-w-[72rem] mx-auto"
      >
        <ScrollDemographics />
      </GalleryRow>
    </main>
  );
}
