# Repository directory layout

This document describes where code and assets live and how responsibilities are split. The goals are: **thin route files** in `app/`, **reusable implementation** under `src/`, and **global styles** in one place (`app/globals.css`).

## Top level

| Path | Role |
|------|------|
| **`app/`** | Next.js App Router: layouts, pages (`page.js`), and future API route handlers (`app/api/.../route.js`). Only routing and composition—import UI from `src/`. |
| **`src/`** | Application source: components, libraries, data modules, and shared non-route CSS. |
| **`public/`** | Static assets served as-is; synced CSV/geo copies land under `public/data/` via `scripts/sync-public-data.mjs`. |
| **`data/`** | Authoritative datasets and inputs (not bundled as public URLs until synced). |
| **`scripts/`** | Node scripts for sync, builds, and maintenance (not imported by the Next.js bundle). |
| **`docs/`** | Project documentation (this file, personas, findings, dataset notes). |

**`docs/archive/`** — Historical Markdown snapshots. **Do not update** these when the app, paths, or copy change; they are reference-only and intentionally stale.

## `app/` — routes only

- **`app/layout.js`** — Root layout (fonts, `globals.css`).
- **`app/page.js`** — Production home: maps and comparisons (see imports).
- **`app/globals.css`** — Design tokens, resets, and **global** utility classes (e.g. narrative typography). Prefer colocated `*.module.css` for component-specific styles in `src/`.

Future **API** handlers belong at **`app/api/.../route.js`** (not under `src/`). Shared logic for those handlers still lives in **`src/lib/`**.

## `src/` — implementation

| Path | Role |
|------|------|
| **`src/components/`** | React components. Feature areas are grouped (e.g. `data-viz/`, `layout/`, `ui/`). |
| **`src/lib/`** | Pure helpers, hooks, and domain logic (equity-map builders, scroll helpers, URLs). |
| **`src/data/`** | Shared layout metadata (e.g. `structure.js` for `GalleryRow` ids). Scroll demographics default copy lives next to **`ScrollDemographics`** (`scrollDemographicsNarrative.js`). |
| **`src/styles/`** | Optional **non-module** CSS shared across routes (add files here if you outgrow `app/globals.css`). Component styles stay as `*.module.css` next to their components unless they are truly global. |

## Related docs

- Personas / historical story copy: [PERSONAS.md](./PERSONAS.md) (may reference removed Vite-era paths; treat as archive unless refreshed).
- Dataset caveats: [DATASET_LIMITATIONS.md](./DATASET_LIMITATIONS.md).
