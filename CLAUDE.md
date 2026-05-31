# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start Vite dev server on port 3000, host `0.0.0.0`
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the built bundle

There is no test runner, linter, or typecheck script configured. TypeScript is compiled by Vite/esbuild; `tsc` is not invoked by any npm script.

## Environment variables

`.env.local` is intentionally empty — the app no longer needs any third-party credentials at runtime. `vite.config.ts` still defines `process.env.API_KEY`/`process.env.GEMINI_API_KEY` from `GEMINI_API_KEY` (legacy AI Studio scaffolding), but nothing imports them.

## Architecture

Single-page React 19 + Vite + TypeScript app that visualises Shebsh-river water levels. Hosting and serverless functions: Vercel. Source of truth: AllRivers HTML, scraped server-side (browser can't reach it directly — no CORS headers).

### Data flow

**Live "Обновить" click (one-shot freshness):**
1. `App.handleUpdateData()` (App.tsx) → `services/waterApi.ts:fetchWaterDataLive()` → `GET /api/water-level`.
2. `api/water-level.ts` — Vercel **Edge Function** that calls `services/scrapeAllRivers.mjs:fetchAndParseWaterData()`, returns `{water_level, change_24h}` as JSON. Edge response is cached at the CDN for 60 s (`s-maxage=60, stale-while-revalidate=300`).
3. App writes the record to localStorage and re-reads history.

**Long-term history (daily snapshots, shared by all visitors):**
1. `.github/workflows/update-history.yml` — cron `0 9 * * *` (12:00 МСК) + `workflow_dispatch`.
2. Runs `scripts/fetch-water-data.mjs`, which reuses `services/scrapeAllRivers.mjs` (same parser as the Edge Function) and appends a `WaterRecord` to `public/history.json`.
3. The bot commits the file; Vercel auto-deploys; visitors fetch the updated `/history.json`.

**Reads (chart + cards):**
- `services/storageClient.ts` merges `/history.json` (canonical, remote) with `localStorage["water_levels_local"]` (per-browser ad-hoc clicks). Remote wins on `created_at` collision. `saveWaterRecord` only ever writes to localStorage — the cron is the only writer to `history.json`.

### The scraper (`services/scrapeAllRivers.mjs`)

Pure JS so both TypeScript (Edge Function) and Node (CI script) can import without a build step. Matches two HTML patterns in the AllRivers page:

```
составляет <b>NUMBER</b> [cс]м   → water_level
(повысился|понизился|не изменился) [на <b>NUMBER</b> [cс]м]   → change_24h with sign
```

Two non-obvious things:
- The unit on the page is sometimes written with Latin `c` (`cм`) and sometimes Cyrillic `с` (`см`); the character class `[cс]м` matches either.
- LLM-based parsers (we previously used ProTalk's GPT-4o-mini) returned change_24h **without a sign** — so a rising vs falling river produced the same number. The verb in the regex restores the sign.

### Hydrological constants (constants.ts)

All level math centres on the Baltic height system ("БСВ"):

- `BRIDGE_BOTTOM_EDGE_BSV = 35.160` m — bridge bottom edge ("НЯ затопления", low threshold)
- `HIGH_FLOOD_LEVEL_BSV = 36.160` m — dangerous flood mark ("ОЯ затопления")
- `GAUGING_STATION_ZERO_BSV = 38.158` m — gauging-station zero datum

`water_level` is stored as **centimetres above the gauging-station zero** (can be negative). Convert to BSV metres: `(water_level / 100) + GAUGING_STATION_ZERO_BSV`. `BRIDGE_LEVEL_CM` is the bridge edge in the same cm-above-zero coordinate, so distance-to-bridge math stays in one system. When changing any of these, audit App.tsx StatCards, `WaterChart` reference lines, and the flood-message conditional together.

### UI

- `components/WaterChart.tsx` — Recharts line chart over merged history.
- `components/StatCard.tsx` — three KPI tiles.
- Tailwind is loaded from CDN in `index.html` with a custom `water-*` palette defined inline there. React/Recharts are resolved from `esm.sh` via the import map in `index.html` — keep import-map versions aligned with `package.json` or dev and prod will diverge.

### Notes for future changes

- All UI strings are Russian and hardcoded in JSX.
- No state management library; component-local `useState` + one `loadData` callback is the entire model.
- Vercel auto-detects `api/` for serverless functions and ships `dist/` (Vite build) as static. No `vercel.json` needed.
