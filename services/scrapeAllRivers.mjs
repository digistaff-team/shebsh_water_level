// Pure-JS scraper shared by the browser-side proxy (api/water-level.ts)
// and the hourly snapshot job (api/cron/snapshot.ts).
// Returns { water_level: number, change_24h: number } in centimetres.
//
// AllRivers no longer embeds the level into the HTML page — the page is a
// Vue SPA that pulls it from a JSON endpoint. GET /map/gauge/<slug> returns
// the gauge item with `current_level: { value, sub_level, updated_at }`,
// where `value` is the water level (cm, relative to the gauging-station zero)
// and `sub_level` is the signed change over the last 24h (cm). Both are
// already in the units/shape this module has always returned.

const GAUGE_SLUG = 'shebsh-grigoryevskaya';

export const ALLRIVERS_URL =
  `https://allrivers.info/map/gauge/${GAUGE_SLUG}`;

const ALLRIVERS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; ShebshMonitor/1.0)',
  Accept: 'application/json',
  'X-Requested-With': 'XMLHttpRequest',
  Referer: `https://allrivers.info/gauge/${GAUGE_SLUG}/waterlevel`,
};

/**
 * Extract { water_level, change_24h } from the /map/gauge JSON payload.
 * Throws when the payload is missing the expected level data.
 */
export function parseWaterDataFromJson(payload) {
  const item = payload?.item;
  const level = item?.current_level;
  const rawValue = level?.value;
  const water_level =
    typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isFinite(water_level)) {
    throw new Error(
      `AllRivers JSON: current_level.value missing or non-finite (${JSON.stringify(
        rawValue
      )})`
    );
  }

  const rawChange = level?.sub_level;
  const change_24h = Number.isFinite(Number(rawChange)) ? Number(rawChange) : 0;

  return { water_level, change_24h };
}

export async function fetchAndParseWaterData() {
  const res = await fetch(ALLRIVERS_URL, {
    headers: ALLRIVERS_HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`AllRivers HTTP ${res.status}`);
  }
  const payload = await res.json();
  if (payload?.success === false) {
    throw new Error('AllRivers JSON: request reported success=false');
  }
  return parseWaterDataFromJson(payload);
}
