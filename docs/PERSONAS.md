# Personas in the full story

**Source of truth:** [`src/data/narrative.js`](../src/data/narrative.js) assembles the full story; persona journeys and UI strings live in [`src/data/copy/personaJourneyCopy.js`](../src/data/copy/personaJourneyCopy.js). Corridor / scroll viz copy: [`corridorMapCopy.js`](../src/data/copy/corridorMapCopy.js). Trip purpose proxy: [`tripPurposeCopy.js`](../src/data/copy/tripPurposeCopy.js). **When you change a persona, edit `personaJourneyCopy.js` first**, then refresh this page so prose here still matches production.

**Full-story assembly:** [`StoryFullExperience.jsx`](../src/components/data-viz/story-full-experience/StoryFullExperience.jsx) — chapters pull from `fullStoryNarrative` and render `PersonaDayCard` (default narrative from the same module).

---

## Pairing rationale (data-driven, Apr 2026 review)

LLB and Stanton Heights were selected because they are the strongest available pairing on every axis that matters:

| Metric | Lincoln-Lemington–Belmar | Stanton Heights | Contrast |
|--------|--------------------------|-----------------|----------|
| **Population** | 4,485 | 4,555 | 98.5% match |
| **Below poverty** | 32.6% (1,356 residents) | 9.8% (435 residents) | **3.3× gap** |
| **Transit-commute proxy** | 25.8% (383 workers) | 9.3% (212 workers) | **2.8× gap** |
| **Routes before FY26** | 8 | 3 | |
| **Routes eliminated** | 2 (P10, P17) | 0 | |
| **Routes major-reduced** | 5 (001, 074, 075, 082, 091) | 2 (087, 091) | |
| **Routes unaffected** | 1 (079) | 1 (089 — retained for equity) | |
| **% routes impacted** | **87.5%** | 66.7% | |

### Why P10 (a "flyer") is defensible

No 30%+ poverty neighborhood in the FY26 dataset loses an eliminated *local* bus where stops are orphaned and population is comparable to Stanton Heights. The eliminated routes hitting 30%+ poverty neighborhoods are commuter flyers — a direct consequence of PRT's efficiency logic, which targets low-ridership routes regardless of the poverty profile of who boards them.

P10 has a **street-level stop** in LLB at WASHINGTON BLVD AT HIGHLAND DR (40.474002, −79.908205, stop E56360) — no park-and-ride lot, no overlapping local route. The "commuter flyer" label is PRT's operational classification; it does not reflect the lived experience of a rider in a 32.6%-poverty neighborhood who boards from a curb with no car backup.

When PRT eliminates P10 for low efficiency:
- **Stop E56360 is orphaned** — no other route at this location in `route_stop_per_route.csv`
- **Nearest fallback:** Rt 74 at DEAN ST AT LARIMER AVE (~0.34 mi / 7 min walk, stop E16270) — itself facing a major FY26 reduction
- **Next option:** Rt 82 on LINCOLN AVE AT ROWAN ST (~0.72 mi / 14 min walk, stop E35920) — also major-reduced
- **P17 stops on Lincoln Ave** are co-served by Rt 82, so P17's elimination orphans zero stops — but Rt 82 is major-reduced

The flyer classification becomes *part of the editorial argument*: the same efficiency logic that labels P10 a "flyer" is blind to the poverty profile of who actually uses these street-level stops.

---

## Who appears in the build

| Slot | Name | Role tag | Neighborhood | Primary FY26 contrast route |
|------|------|----------|----------------|----------------------------|
| **A** | Marcus | Choice rider | Stanton Heights | **71B** Highland Park — minor reduction; BRT spine (University Line); Rt 089 retained for equity |
| **B** | Denise | Dependent rider | Lincoln-Lemington–Belmar | **P10** Allegheny Valley Flyer — eliminated; boards **WASHINGTON BLVD AT HIGHLAND DR** (40.474°N, 79.908°W, stop E56360 — no same-stop substitute) |

Exports in code:

- **`personaDayCardNarrative`** — section headings, UI strings, **`personas.a` / `personas.b`** (journeys, schedules, stats, after-cut consequences).
- **`personas`** — shorthand: `personaDayCardNarrative.personas`.
- **`storyStopCoordinates`** — stop-level coordinates for P10 orphaned stop and fallback stops (Rt 74, Rt 82).
- **`neighborhoodFY26Impact`** — compound route impact data for both neighborhoods.
- **`fullStoryNarrative`** — opening, FY26 stats block, corridor map steps, pull quote, trip-purpose framing, dot-map dek.
- **`scrollDemographicsNarrative`** — scroll scene with abstract 71B vs P10 paths.
- **`STORY_ROUTE_FY26_LOOKUP`** — editorial FY26 treatment flags for named routes in the story layer.

---

## Stop coordinates (from `route_stop_per_route.csv`)

| Stop ID | Name | Lat | Lon | Routes | Orphaned after FY26 | Walk from P10 stop |
|---------|------|-----|-----|--------|--------------------|--------------------|
| **E56360** | WASHINGTON BLVD AT HIGHLAND DR | 40.474002 | −79.908205 | P10 only | **Yes** | — |
| E16270 | DEAN ST AT LARIMER AVE | 40.469236 | −79.905671 | 74 | No (74 major-reduced) | ~0.34 mi / 7 min |
| E35920 | LINCOLN AVE AT ROWAN ST | 40.463924 | −79.902007 | 82, P17 | No (82 major-reduced; P17 eliminated) | ~0.72 mi / 14 min |
| E35770 | LINCOLN AVE AT ARBOR ST | 40.466431 | −79.89777 | 82, P17 | No (same as above) | — |

---

## Neighborhood & data notes

- Profile table: **`data/fy26_route_n_profiles_all.csv`** — Stanton Heights and Lincoln-Lemington-Belmar rows drive poverty / transit-commute figures cited in copy.
- LLB: **32.6%** below poverty, **25.8%** transit-commute proxy (workers), pop **4,485**. **7 of 8 routes impacted.**
- Stanton Heights: **9.8%** below poverty, **9.3%** transit-commute proxy, pop **4,555**. **0 routes eliminated; Rt 089 retained for equity.**
- Stanton Heights median income and no-car share in Marcus's card include **ILLUSTRATIVE** labels — confirm against ACS before presenting as final fact.
- Stops: **`data/route_stop_per_route.csv`**; FY26 labels: **`data/FY26_route_status_all.csv`**. No bundled **`stop_times.txt`** — clock times and some addresses are **illustrative / composite**.

---

## Journey steps (bullet export)

Mirrors `personaDayCardNarrative.personas` in [`src/data/copy/personaJourneyCopy.js`](../src/data/copy/personaJourneyCopy.js) (`journeyBefore`, `journeyAfter`, `trips`, `daySchedule`). Copy/paste into slides, docs, or sheets as needed.

### Marcus — timeline (`trips`)

- **7:10am** — Walks to 71B on Stanton Ave
- **7:18am** — Boards 71B toward Downtown
- **7:50am** — Walks from stop to desk

### Marcus — journey before cuts (`journeyBefore`)

- Start: **Home**
- **6 min** — first mile: walk to 71B on Stanton Ave → **71B stop**
- **26 min** — transit: 71B Highland Park → Downtown (Penn / Liberty corridor) → **Downtown**
- **6 min** — first mile: walk → **office**

### Marcus — journey after cuts (`journeyAfter`)

- Start: **Home**
- **6 min** — first mile: walk to 71B (same stop) → **71B stop**
- **32 min** — transit: 71B · slightly longer off-peak waits → **Downtown**
- **6 min** — first mile: walk → **office**
- *Rt 089 retained for equity; drive alternative ~20 min, $14–18/day parking*

### Denise — timeline (`trips`)

- **6:15am** — Leaves composite home — Washington Pl. (illustrative)
- **6:29am** — Kid at Lincoln K-8, 328 Lincoln Ave
- **6:41am** — Boards P10 at WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W)
- **7:07am** — FIFTH AVE AT HAMILTON AVE; walks to shift

### Denise — day schedule before cuts (`daySchedule.beforeRows`)

- **Places** — Home: 7426 Washington Pl., Pittsburgh 15206 (composite, unverified)
- School: Pittsburgh Lincoln K-8 — 328 Lincoln Ave (kid drop-off)
- Work: Liberty Ave & Smithfield St — shift job, Central Business District
- Doctor (quarterly): primary care — UPMC Shadyside Family Health Center, Centre Ave & Somerset Pl. (before cuts: P10 → busway/Fifth, illustrative)
- **6:15a** — Leave home — walk with child toward Lincoln Ave
- **6:29a** — Lincoln K-8 drop-off
- **6:35a** — Walk to WASHINGTON BLVD AT HIGHLAND DR (40.474°N, 79.908°W — stop E56360; P10 only at this stop)
- **6:41a** — Board P10 Allegheny Valley Flyer inbound — classified as a commuter flyer, but boarded from a street-level curb in a 32.6%-poverty neighborhood
- **7:07a** — Alight FIFTH AVE AT HAMILTON AVE — walk to Liberty & Smithfield
- **7:30a** — Clock-in

### Denise — day schedule after cuts (`daySchedule.afterRows`)

- **Places** — Same home, school, work & doctor as before — commute path changes
- **6:15a** — Leave home; Lincoln K-8 drop-off (same)
- **6:35a** — WASHINGTON BLVD AT HIGHLAND DR — P10 eliminated; stop orphaned, no other route at this location
- **6:42a** — Walk ~0.34 mi to Rt 74 at DEAN ST AT LARIMER AVE (40.469°N, 79.906°W — stop E16270; major-reduced in FY26)
- **6:52a** — Board 74 Homewood–Squirrel Hill inbound (illustrative)
- **7:34a** — Downtown late — walk to Liberty & Smithfield
- **7:45a+** — After clock-in / disciplinary risk (illustrative)
- **Quarterly** — Doctor visits: midday means walk to 74 or Rt 82 on Lincoln Ave (~0.72 mi / 14 min from old P10 stop); both major-reduced

### Denise — journey before cuts (`journeyBefore`)

- Start: **Home (illustrative)**
- **14 min** — first mile: walk with kid to Pittsburgh Lincoln K-8, 328 Lincoln Ave → **school**
- **6 min** — first mile: walk to WASHINGTON BLVD AT HIGHLAND DR (40.474°N — sole P10 stop; no other route here) → **WASHINGTON BLVD AT HIGHLAND DR**
- **26 min** — transit: P10 inbound → FIFTH AVE AT HAMILTON AVE (PRT labels this a 'commuter flyer'; Denise boards from the curb) → **FIFTH AVE AT HAMILTON AVE**
- **8 min** — first mile: walk to Liberty Ave & Smithfield St (work) → **work (7:30a shift)**

### Denise — journey after cuts (`journeyAfter`)

- Start: **Home (illustrative)**
- **14 min** — first mile: walk with kid to Lincoln K-8 (same) → **school**
- **6 min** — first mile: walk to WASHINGTON BLVD AT HIGHLAND DR — stop orphaned → **WASHINGTON BLVD AT HIGHLAND DR (orphaned)**
- **10 min** — uncertain: P10 eliminated — no other route at this stop; walk ~0.34 mi to nearest Rt 74 → **replanning**
- **7 min** — first mile: walk to 74 at DEAN ST AT LARIMER AVE (40.469°N, stop E16270) → **74 stop**
- **42 min** — transit: 74 Homewood–Squirrel Hill → Downtown (major reduction; illustrative) → **Downtown (late)**
- **10 min** — first mile: walk to Liberty & Smithfield → **work (after clock-in)**

---

## Story beats tied to each persona

- **Before cuts:** `PersonaDayCard` phase `before` — Marcus's 71B commute; Denise's P10 morning (kid drop at Lincoln K-8, WASHINGTON BLVD AT HIGHLAND DR at 40.474°N).
- **After cuts:** `PersonaDayCard` phase `after` — Marcus: longer waits / drive option, all routes preserved; Denise: P10 elimination, orphaned stop, 7-min walk to major-reduced Rt 74, compound impact across 7 of 8 routes.
- **Corridor map chapter:** `corridorMap` steps in [`corridorMapCopy.js`](../src/data/copy/corridorMapCopy.js) — poverty, transit dependence, FY26 outcomes with flyer-classification framing.
- **Pull quote:** `fullStoryNarrative.pullQuote` — PRT classifies P10 as a commuter flyer; the orphaned stop at 40.474°N is the rider's reality.
- **Trip purpose proxy:** `fullStoryNarrative.tripPurpose` — 71B as "choice" corridor vs P10 as "need" corridor (industry mix proxy).

---

## Keeping this document current

1. Edit personas in **`src/data/copy/personaJourneyCopy.js`**; corridor / scroll demographics in **`src/data/copy/corridorMapCopy.js`**; trip purpose in **`src/data/copy/tripPurposeCopy.js`**; overarching story + `STORY_ROUTE_FY26_LOOKUP` in **`src/data/narrative.js`**.
2. Update **this file** if any of the following change: names, neighborhoods, route codes, key stops, data file references, or the list of exports/chapters that use them.
3. Optional checks: run the app and walk **`/`** (full story) or mount `PersonaDayCard` in a local page while editing.

If this doc drifts from the copy modules or `narrative.js`, **trust the code** for what ships; then align this markdown.
