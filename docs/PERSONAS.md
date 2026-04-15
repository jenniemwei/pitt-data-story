# Personas in the full story

**Source of truth:** [`src/data/narrative.js`](../src/data/narrative.js). All copy, stats labels, journey segments, and FY26 route framing for the story live there. **When you change a persona, update that file first**, then refresh this page so prose here still matches production.

**Full-story assembly:** [`StoryFullExperience.jsx`](../src/components/data-viz/story-full-experience/StoryFullExperience.jsx) — chapters pull from `fullStoryNarrative` and render `PersonaDayCard` (default narrative from the same module).

---

## Who appears in the build

| Slot | Name | Role tag | Neighborhood | Primary FY26 contrast route |
|------|------|----------|----------------|----------------------------|
| **A** | Marcus | Choice rider | Stanton Heights | **71B** Highland Park — minor reduction; BRT spine (per story notes) |
| **B** | Denise | Dependent rider | Lincoln-Lemington–Belmar | **P10** Allegheny Valley Flyer — eliminated; boards **WASHINGTON BLVD AT HIGHLAND DR** (no same-stop local in build data) |

Exports in code:

- **`personaDayCardNarrative`** — section headings, UI strings, **`personas.a` / `personas.b`** (journeys, schedules, stats, after-cut consequences).
- **`personas`** — shorthand: `personaDayCardNarrative.personas`.
- **`fullStoryNarrative`** — opening, FY26 stats block, corridor map steps, pull quote, trip-purpose framing, dot-map dek; references the same two corridors and neighborhoods.
- **`scrollDemographicsNarrative`** — scroll scene with abstract 71B vs P10 paths (used from `CorridorScrollMap` with `fullStoryNarrative` corridor copy).
- **`STORY_ROUTE_FY26_LOOKUP`** — editorial FY26 treatment flags for named routes in the story layer.

---

## Neighborhood & data notes (from `narrative.js` header)

- Profile table: **`data/fy26_route_n_profiles_all.csv`** — Stanton Heights and Lincoln-Lemington-Belmar rows drive poverty / transit-commute figures cited in copy.
- Denise pocket (LLB): ~**32.6%** below poverty, ~**25.8%** transit-commute proxy (workers), pop **4,485** (values as documented in narrative comments).
- Stanton Heights: median income and no-car share in Marcus’s card include **ILLUSTRATIVE** labels — confirm against ACS before presenting as final fact.
- Stops: **`data/route_stop_per_route.csv`**; FY26 labels: **`data/FY26_route_status_all.csv`**. No bundled **`stop_times.txt`** — clock times and some addresses are **illustrative / composite**.

---

## Journey steps (bullet export)

Mirrors `personaDayCardNarrative.personas` in [`src/data/narrative.js`](../src/data/narrative.js) (`journeyBefore`, `journeyAfter`, `trips`, `daySchedule`). Copy/paste into slides, docs, or sheets as needed.

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

### Denise — timeline (`trips`)

- **6:15am** — Leaves composite home — Washington Pl. (illustrative)
- **6:29am** — Kid at Lincoln K-8, 328 Lincoln Ave
- **6:41am** — Boards P10 at WASHINGTON BLVD AT HIGHLAND DR
- **7:07am** — FIFTH AVE AT HAMILTON AVE; walks to shift

### Denise — day schedule before cuts (`daySchedule.beforeRows`)

- **Places** — Home: 7426 Washington Pl., Pittsburgh 15206 (composite, unverified)
- School: Pittsburgh Lincoln K-8 — 328 Lincoln Ave (kid drop-off)
- Work: Liberty Ave & Smithfield St — shift job, Central Business District
- Doctor (quarterly): primary care — UPMC Shadyside Family Health Center, Centre Ave & Somerset Pl. (before cuts: P10 → busway/Fifth, illustrative)
- **6:15a** — Leave home — walk with child toward Lincoln Ave
- **6:29a** — Lincoln K-8 drop-off
- **6:35a** — Walk to WASHINGTON BLVD AT HIGHLAND DR (PRT stop; P10 only at this pair in build data)
- **6:41a** — Board P10 Allegheny Valley Flyer inbound (Fifth Ave / East Busway pattern — illustrative)
- **7:07a** — Alight FIFTH AVE AT HAMILTON AVE — walk to Liberty & Smithfield
- **7:30a** — Clock-in

### Denise — day schedule after cuts (`daySchedule.afterRows`)

- **Places** — Same home, school, work & doctor as before — commute path changes
- **6:15a** — Leave home; Lincoln K-8 drop-off (same)
- **6:35a** — WASHINGTON BLVD AT HIGHLAND DR — no P10; replan (illustrative wait)
- **6:45a** — Walk to 74 — HIGHLAND DR OPP JOB CORPS DR (major-reduced 74 in FY26 scenario)
- **6:52a** — Board 74 Homewood–Squirrel Hill inbound (illustrative)
- **7:34a** — Downtown late — walk to Liberty & Smithfield
- **7:45a+** — After clock-in / disciplinary risk (illustrative)
- **Quarterly** — Doctor visits: same UPMC Shadyside clinic — after cuts, midday means a longer walk to 74 + thinner headways on major-reduced locals (illustrative)

### Denise — journey before cuts (`journeyBefore`)

- Start: **Home (illustrative)**
- **14 min** — first mile: walk with kid to Pittsburgh Lincoln K-8, 328 Lincoln Ave (PRT stop data: LLB) → **school**
- **6 min** — first mile: walk to WASHINGTON BLVD AT HIGHLAND DR (sole P10 boarding pair here) → **WASHINGTON BLVD AT HIGHLAND DR**
- **26 min** — transit: P10 Allegheny Valley Flyer inbound → FIFTH AVE AT HAMILTON AVE (via Fifth / busway — illustrative) → **FIFTH AVE AT HAMILTON AVE**
- **8 min** — first mile: walk to Liberty Ave & Smithfield St (work) → **work (7:30a shift)**

### Denise — journey after cuts (`journeyAfter`)

- Start: **Home (illustrative)**
- **14 min** — first mile: walk with kid to Lincoln K-8 (same) → **school**
- **6 min** — first mile: walk to WASHINGTON BLVD AT HIGHLAND DR — no bus → **WASHINGTON BLVD AT HIGHLAND DR**
- **10 min** — uncertain: P10 eliminated — no other route at this stop pair in build data (illustrative) → **replanning**
- **14 min** — first mile: walk to 74 at HIGHLAND DR OPP JOB CORPS DR → **74 stop**
- **42 min** — transit: 74 Homewood–Squirrel Hill → Downtown (major reduction; illustrative) → **Downtown (late)**
- **10 min** — first mile: walk to Liberty & Smithfield → **work (after clock-in)**

---

## Story beats tied to each persona

- **Before cuts:** `PersonaDayCard` phase `before` — Marcus’s 71B commute; Denise’s P10 morning (kid drop at Lincoln K-8, WASHINGTON BLVD AT HIGHLAND DR).
- **After cuts:** `PersonaDayCard` phase `after` — longer waits / drive option vs P10 elimination and fallback (e.g. walk to major-reduced **74**, illustrative).
- **Corridor map chapter:** `fullStoryNarrative.corridorMap` steps (poverty, transit, FY26 outcomes) and `scrollDemographicsNarrative.routes.keep` / `.cut` (Marcus + 71B, Denise + P10).
- **Pull quote:** `fullStoryNarrative.pullQuote` — WASHINGTON BLVD AT HIGHLAND DR / P10-only stop framing.
- **Trip purpose proxy:** `fullStoryNarrative.tripPurpose` — 71B as “choice” corridor vs P10 as “need” corridor (industry mix proxy).

---

## Keeping this document current

1. Edit personas in **`src/data/narrative.js`** (`personaDayCardNarrative.personas`, `fullStoryNarrative`, `scrollDemographicsNarrative`, `STORY_ROUTE_FY26_LOOKUP` as needed).
2. Update **this file** if any of the following change: names, neighborhoods, route codes, key stops, data file references, or the list of exports/chapters that use them.
3. Optional checks: run the app and walk **`/`** (full story) or mount `PersonaDayCard` in a local page while editing.

If this doc drifts from `narrative.js`, **trust the code** for what ships; then align this markdown.
