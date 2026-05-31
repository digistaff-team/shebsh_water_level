# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start Vite dev server on port 3000, host `0.0.0.0`
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the built bundle

There is no test runner, linter, or typecheck script configured. TypeScript is compiled by Vite/esbuild; `tsc` is not invoked by any npm script.

## Environment variables

Set in `.env.local` (loaded by Vite via `loadEnv`):

- `VITE_PROTALK_BOT_TOKEN`, `VITE_PROTALK_BOT_ID` — ProTalk bot credentials. `protalkService.assertProTalkConfig()` throws if either is missing when the user clicks "Обновить".
- `GEMINI_API_KEY` — exposed to client code as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY` via `vite.config.ts` `define` (held over from the AI Studio template; `@google/genai` is a dependency but not currently imported anywhere).

Persistence now uses browser `localStorage` (`services/storageClient.ts`) — no Supabase or other backend required.

## Architecture

Single-page React 19 + Vite + TypeScript app that visualises water-level history for the Shebsh river. There is no backend in this repo — the app talks directly to two third-party services from the browser.

### Data flow (one update cycle)

1. `App.loadData()` (App.tsx:17) runs on mount: pulls history + latest record from `localStorage`. If the latest record is older than 24h (or absent), it auto-triggers `handleUpdateData()`.
2. `handleUpdateData()` (App.tsx:57) orchestrates: ProTalk scrape → parse → derive `Trend` → save → reload UI.
3. `services/protalkService.ts`:
   - `fetchRawTextFromUrl()` sends `/clear` to reset chat context, then asks the ProTalk bot to run function `#18 get_text_from_url` against `TARGET_URL` (`https://allrivers.info/gauge/shebsh-grigoryevskaya/waterlevel`) and return a fixed-format string.
   - `parseProTalkRawText()` regex-extracts the two numbers (level in cm, 24h change in cm), tolerating commas as decimal separators and Russian `см` / English `cm` units.
4. `services/storageClient.ts` has two sources:
   - **Remote** (canonical): `public/history.json`, fetched once per page load. Maintained by `.github/workflows/update-history.yml` — a cron job that runs `scripts/fetch-water-data.mjs` daily at 09:00 UTC (12:00 МСК), appends a fresh `WaterRecord`, and commits the file. The next Vercel deploy ships the updated history.
   - **Local** (per-browser supplement): `localStorage` under key `water_levels_local`. Used when the user clicks "Обновить" between cron runs, so they see their own ad-hoc readings.
   `fetchWaterHistory` merges both (remote wins on `created_at` collision) and sorts. `saveWaterRecord` only writes to localStorage — the cron is the only writer to `history.json`. Required GitHub repo secrets for the workflow: `PROTALK_BOT_TOKEN`, `PROTALK_BOT_ID`.

### Hydrological constants (constants.ts)

All level math centres on the Baltic height system ("БСВ"). Two reference levels matter:

- `BRIDGE_BOTTOM_EDGE_BSV = 35.160` m — bridge bottom edge ("НЯ затопления", low threshold)
- `HIGH_FLOOD_LEVEL_BSV = 36.160` m — dangerous flood mark ("ОЯ затопления")
- `GAUGING_STATION_ZERO_BSV = 38.158` m — gauging-station zero datum

`water_level` stored in Supabase is **centimetres above the gauging-station zero** (can be negative when the river is below the datum). To convert to BSV metres: `(water_level / 100) + GAUGING_STATION_ZERO_BSV`. `BRIDGE_LEVEL_CM` is the bridge edge expressed in the same cm-above-zero units used by `water_level`, so "until bridge" comparisons stay in one coordinate system.

When changing any of these constants, audit App.tsx StatCards (the "До моста" / "Мост затоплен" logic), `WaterChart` reference lines, and the flood-message conditional together — they all assume the same coordinate convention.

### UI

- `components/WaterChart.tsx` — Recharts line chart over `history`.
- `components/StatCard.tsx` — three KPI tiles (current level in BSV metres, 24h change, distance to bridge).
- Tailwind is loaded from CDN in `index.html`; a custom `water-*` colour palette is defined inline there (not in a Tailwind config file). React/Recharts/Supabase are also resolved from `esm.sh` via the import map in `index.html` — keep that import map in sync with `package.json` versions or dev and prod will diverge.

### Notes for future changes

- All localisation strings are Russian and hardcoded in JSX.
- No state management library; component-local `useState` + a single `loadData` callback is the whole model.
- The ProTalk prompt in `fetchRawTextFromUrl` is deliberately ASCII-only — non-ASCII characters in past versions caused encoding issues at the API boundary.
