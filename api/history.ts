// GET /api/history → WaterRecord[] (sorted ascending by created_at).
// Reads both ZSETs maintained by api/cron/snapshot.ts:
//   history:hourly — last 30 days at 1-hour resolution
//   history:daily  — older than 30 days, one median record per UTC day
// Both store compact JSON members: {"t":<ms>,"l":<cm>,"c":<cm signed>}.

export const config = { runtime: 'edge' };

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const HOURLY_KEY = 'history:hourly';
const DAILY_KEY = 'history:daily';

type Cmd = (string | number)[];

interface Entry {
  t: number;
  l: number;
  c: number;
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

const trendOf = (change: number): 'RISING' | 'FALLING' | 'STABLE' =>
  change > 0 ? 'RISING' : change < 0 ? 'FALLING' : 'STABLE';

export default async function handler(): Promise<Response> {
  try {
    const results = await kv([
      ['ZRANGE', DAILY_KEY, '0', '-1'],
      ['ZRANGE', HOURLY_KEY, '0', '-1'],
    ]);
    const all: Entry[] = [];
    for (const r of results) {
      const members: string[] = Array.isArray(r?.result) ? r.result : [];
      for (const m of members) {
        try {
          const e = JSON.parse(m);
          if (typeof e?.t === 'number' && typeof e?.l === 'number') {
            all.push({ t: e.t, l: e.l, c: typeof e.c === 'number' ? e.c : 0 });
          }
        } catch {
          /* skip malformed */
        }
      }
    }
    all.sort((a, b) => a.t - b.t);
    const records = all.map((e) => ({
      id: e.t,
      water_level: e.l,
      change_24h: e.c,
      trend: trendOf(e.c),
      created_at: new Date(e.t).toISOString(),
    }));
    return Response.json(records, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
