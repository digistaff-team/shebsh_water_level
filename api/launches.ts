// Records one app launch (POST) or just reads the current stats (GET).
// Stores timestamps in a Redis ZSET; KV is provisioned via Vercel
// dashboard → Storage → Upstash KV, which auto-injects KV_REST_API_URL
// and KV_REST_API_TOKEN into the environment.

export const config = { runtime: 'edge' };

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const KEY = 'launches';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 90 * DAY_MS;

type PipelineCmd = (string | number)[];

async function pipeline(commands: PipelineCmd[]): Promise<any[]> {
  if (!KV_URL || !KV_TOKEN) {
    throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN not set');
  }
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

const statsCommands = (now: number): PipelineCmd[] => [
  ['ZCOUNT', KEY, now - DAY_MS, '+inf'],
  ['ZCOUNT', KEY, now - 7 * DAY_MS, '+inf'],
  ['ZCOUNT', KEY, now - 30 * DAY_MS, '+inf'],
  ['ZCARD', KEY],
];

const extractStats = (results: any[]) => {
  const [day, week, month, total] = results.slice(-4).map((r) => Number(r?.result ?? 0));
  return { day, week, month, total };
};

export default async function handler(req: Request): Promise<Response> {
  try {
    const now = Date.now();

    if (req.method === 'POST') {
      const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
      const cutoff = now - RETENTION_MS;
      const results = await pipeline([
        ['ZADD', KEY, now, member],
        ['ZREMRANGEBYSCORE', KEY, '-inf', `(${cutoff}`],
        ...statsCommands(now),
      ]);
      return Response.json(extractStats(results), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (req.method === 'GET') {
      const results = await pipeline(statsCommands(now));
      return Response.json(extractStats(results), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? 'Unknown error' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
