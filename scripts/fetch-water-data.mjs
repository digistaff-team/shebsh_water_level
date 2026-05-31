// Called once per day by .github/workflows/update-history.yml.
// Scrapes the AllRivers page directly (no LLM, no ProTalk) and appends a
// new record to public/history.json. The workflow then commits the file
// so it ships with the next Vercel deploy.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fetchAndParseWaterData } from '../services/scrapeAllRivers.mjs';

const HISTORY_PATH = 'public/history.json';

console.log('[1] fetching AllRivers…');
const { water_level, change_24h } = await fetchAndParseWaterData();
console.log('[2] parsed:', { water_level, change_24h });

const trend =
  change_24h > 0 ? 'RISING' : change_24h < 0 ? 'FALLING' : 'STABLE';

let history = [];
if (existsSync(HISTORY_PATH)) {
  try {
    const parsed = JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
    if (Array.isArray(parsed)) history = parsed;
  } catch (e) {
    console.warn('Could not parse existing history, starting fresh:', e.message);
  }
}

const id = history.reduce((m, r) => Math.max(m, r.id ?? 0), 0) + 1;
const record = {
  id,
  water_level,
  change_24h,
  trend,
  created_at: new Date().toISOString(),
};
history.push(record);

writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
console.log('[3] appended:', record);
console.log(`[4] history now has ${history.length} records`);
