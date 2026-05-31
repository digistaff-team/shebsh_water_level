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

**Long-term history (hourly snapshots, shared by all visitors):**
1. `vercel.json` declares a Vercel Cron at `0 * * * *` hitting `/api/cron/snapshot`.
2. `api/cron/snapshot.ts` — Edge Function: scrapes AllRivers via `services/scrapeAllRivers.mjs`, then `ZADD`s a compact `{t,l,c}` member into the `history:hourly` ZSET in Vercel KV (score = timestamp ms). Auth via `Authorization: Bearer ${CRON_SECRET}` (Vercel attaches this header automatically when `CRON_SECRET` is set).
3. Once per UTC day (at 00:00) the same handler rolls hourly entries older than 30 days into `history:daily` — one median-per-day record — and then `ZREMRANGEBYSCORE`s them out of `history:hourly`. So `history:hourly` is bounded to ~720 entries; `history:daily` grows unbounded but cheaply (~365 entries/year).

**Reads (chart + cards):**
- `api/history.ts` — GET Edge Function: `ZRANGE`s both ZSETs, merges, returns `WaterRecord[]` sorted ascending. CDN-cached `s-maxage=60, stale-while-revalidate=300`.
- `services/storageClient.ts` fetches `/api/history` (canonical, remote) and merges with `localStorage["water_levels_local"]` (per-browser ad-hoc clicks). Remote wins on `created_at` collision. `saveWaterRecord` only ever writes to localStorage — the Vercel Cron is the only writer to KV history.
- `public/history.json` is the pre-migration archive (Apr–May 2026 era, populated by the now-removed GitHub Actions cron). Nothing reads it at runtime; keep it as a recovery snapshot.

**Launch analytics (global counter shown in footer):**
- `api/launches.ts` — Edge Function backed by Vercel KV (Upstash Redis). POST records a launch (ZADD timestamp); GET returns `{day, week, month, total}` via ZCOUNT/ZCARD.
- Provisioning: Vercel dashboard → Storage → Upstash KV → attach to project. KV auto-injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars; the history cron (above) reuses the same KV instance and same env vars. `CRON_SECRET` is added separately in Vercel project settings.
- `services/analyticsApi.ts` POSTs once per browser session (deduped via sessionStorage flag), GETs on subsequent renders. Tolerates KV outage by silently returning null, hiding the footer line.
- Hourly cron snapshots never hit `/api/launches`, so they don't pollute the counter — Vercel Cron calls only `/api/cron/snapshot`, which writes to the separate `history:hourly` ZSET.

### The scraper (`services/scrapeAllRivers.mjs`)

Pure JS so any TypeScript Edge Function can `import` it without a build step (`api/water-level.ts` and `api/cron/snapshot.ts` both do). Matches two HTML patterns in the AllRivers page:

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
- Vercel auto-detects `api/` for serverless functions and ships `dist/` (Vite build) as static. `vercel.json` exists only to declare the hourly cron.
