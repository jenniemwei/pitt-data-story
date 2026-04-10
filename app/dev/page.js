import Link from "next/link";

export const metadata = {
  title: "Dev playground",
  description: "Switch between story components for local testing",
};

export default function DevHubPage() {
  return (
    <div className="dev-lab-hub">
      <h1>Dev playground</h1>
      <p>
        Temporary hub for previews. Use the sticky nav above to switch views. Production entry remains{" "}
        <Link href="/">/</Link>.
      </p>
      <div className="dev-lab-cards">
        <Link href="/dev/equity-map" className="dev-lab-card">
          <h2>Equity map</h2>
          <p>PRT neighborhood map, route overlays, vulnerability controls.</p>
        </Link>
        <Link href="/dev/equity-map-global-grid" className="dev-lab-card">
          <h2>Equity dots (global grid)</h2>
          <p>EquityMap3 — single lattice, poverty-colored dots (uniform size).</p>
        </Link>
        <Link href="/dev/car-ownership" className="dev-lab-card">
          <h2>Car ownership chart</h2>
          <p>Scene 02 — choice vs dependent riders, horizontal bars.</p>
        </Link>
        <Link href="/dev/persona-day" className="dev-lab-card">
          <h2>Persona journeys</h2>
          <p>Before/after vertical journeys — leg height scales with minutes; consequences after cuts.</p>
        </Link>
        <Link href="/dev/trip-purpose-proxy" className="dev-lab-card">
          <h2>Trip purpose proxy</h2>
          <p>Scene 02 or 06 — industry mix along corridors as a trip-purpose proxy.</p>
        </Link>
        <Link href="/dev/scroll-demographics" className="dev-lab-card">
          <h2>Scroll demographics</h2>
          <p>71B vs 74 — sticky abstract map, three scroll overlays.</p>
        </Link>
        <div className="dev-lab-card dev-lab-card--muted">
          <h2>More soon</h2>
          <p>Add a route under <code>app/dev/</code> and a card linking here.</p>
        </div>
      </div>
    </div>
  );
}
