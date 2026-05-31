// Vercel Cron target (schedule in vercel.json). Runs hourly:
//   1. scrape AllRivers
//   2. ZADD the reading into history:hourly
//   3. once per UTC day (at 00:00) roll hourly entries older than 30 days
//      into a median-per-day record in history:daily, then prune them.
//
// Cron requests are authenticated via the Authorization: Bearer <CRON_SECRET>
// header that Vercel attaches automatically when CRON_SECRET is set.
// @ts-ignore - .mjs has no type declarations, pure JS shared helper
import { fetchAndParseWaterData } from '../../services/scrapeAllRivers.mjs';

export const config = { runtime: 'edge' };

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

const HOURLY_KEY = 'history:hourly';
const DAILY_KEY = 'history:daily';
const DAY_MS = 24 * 60 * 60 * 1000;
const HOURLY_RETENTION_MS = 30 * DAY_MS;

type Cmd = (string | number)[];

interface Entry {
  t: number; // timestamp ms
  l: number; // water level (cm above gauging-station zero)
  c: number; // change_24h (cm, signed)
}

async function kv(commands: Cmd[]): Promise<any[]> {
  if (!KV_URL || !KV_TOKEN) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN not set');
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands.map((c) => c.map(String))),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`KV ${res.status}: ${body || res.statusText}`);
  }
  return res.json();
}

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function utcMidnight(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

async function rolloverOldHourly(now: number): Promise<void> {
  const cutoff = now - HOURLY_RETENTION_MS;
  const [raw] = await kv([['ZRANGEBYSCORE', HOURLY_KEY, '-inf', `(${cutoff}`]]);
  const members: string[] = Array.isArray(raw?.result) ? raw.result : [];
  if (!members.length) return;

  const byDay = new Map<number, Entry[]>();
  for (const m of members) {
    try {
      const e = JSON.parse(m) as Entry;
      if (typeof e?.t !== 'number' || typeof e?.l !== 'number') continue;
      const day = utcMidnight(e.t);
      const arr = byDay.get(day) ?? [];
      arr.push(e);
      byDay.set(day, arr);
    } catch {
      /* skip malformed member */
    }
  }

  const cmds: Cmd[] = [];
  for (const [day, entries] of byDay) {
    const dailyEntry: Entry = {
      t: day,
      l: Math.round(median(entries.map((e) => e.l))),
      c: Math.round(median(entries.map((e) => e.c))),
    };
    // Idempotency: drop any prior daily record for this same day before re-adding.
    cmds.push(['ZREMRANGEBYSCORE', DAILY_KEY, day, day]);
    cmds.push(['ZADD', DAILY_KEY, day, JSON.stringify(dailyEntry)]);
  }
  cmds.push(['ZREMRANGEBYSCORE', HOURLY_KEY, '-inf', `(${cutoff}`]);
  await kv(cmds);
}

export default async function handler(req: Request): Promise<Response> {
  if (CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  try {
    const { water_level, change_24h } = await fetchAndParseWaterData();
    const now = Date.now();
    const entry: Entry = { t: now, l: water_level, c: change_24h };

    await kv([['ZADD', HOURLY_KEY, now, JSON.stringify(entry)]]);

    if (new Date(now).getUTCHours() === 0) {
      await rolloverOldHourly(now);
    }

    return Response.json({ ok: true, water_level, change_24h, at: now });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 502 }
    );
  }
}
