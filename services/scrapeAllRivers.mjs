// Pure-JS scraper shared by the browser-side proxy (api/water-level.ts)
// and the CI snapshot job (scripts/fetch-water-data.mjs).
// Returns { water_level: number, change_24h: number } in centimetres.

export const ALLRIVERS_URL =
  'https://allrivers.info/gauge/shebsh-grigoryevskaya/waterlevel';

// AllRivers writes the unit as either "cм" (Latin c) or "см" (Cyrillic с),
// so allow either letter in the character class.
const LEVEL_RE = /составляет\s*<b>(-?\d+(?:[.,]\d+)?)<\/b>\s*[cс]м/i;
const CHANGE_RE =
  /(повысился|понизился|не\s+изменился)(?:\s+на\s*<b>(-?\d+(?:[.,]\d+)?)<\/b>\s*[cс]м)?/i;

export function parseWaterDataFromHtml(html) {
  const levelMatch = html.match(LEVEL_RE);
  if (!levelMatch) {
    throw new Error('AllRivers HTML: water level pattern not found');
  }
  const water_level = parseFloat(levelMatch[1].replace(',', '.'));
  if (!Number.isFinite(water_level)) {
    throw new Error(`AllRivers HTML: non-finite water level "${levelMatch[1]}"`);
  }

  const changeMatch = html.match(CHANGE_RE);
  const verb = changeMatch?.[1] ?? '';
  const rawChange = changeMatch?.[2]
    ? parseFloat(changeMatch[2].replace(',', '.'))
    : 0;
  const change_24h = /понизился/i.test(verb)
    ? -rawChange
    : /повысился/i.test(verb)
      ? rawChange
      : 0;

  return { water_level, change_24h };
}

export async function fetchAndParseWaterData() {
  const res = await fetch(ALLRIVERS_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShebshMonitor/1.0)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`AllRivers HTTP ${res.status}`);
  }
  const html = await res.text();
  return parseWaterDataFromHtml(html);
}
