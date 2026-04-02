import EquityMap from "./components/EquityMap";

export default function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>PRT Equity Map</h1>
        <p>
          Transit dependency by neighborhood with route-cut overlay and
          comparison controls.
        </p>
      </header>
      <EquityMap />
    </main>
  );
}
