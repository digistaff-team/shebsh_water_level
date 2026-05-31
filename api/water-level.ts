// Vercel Edge Function: server-side AllRivers proxy, side-stepping CORS.
// GET /api/water-level → { water_level, change_24h }
// @ts-ignore - .mjs has no type declarations, pure JS shared helper
import { fetchAndParseWaterData } from '../services/scrapeAllRivers.mjs';

export const config = { runtime: 'edge' };

export default async function handler(): Promise<Response> {
  try {
    const data = await fetchAndParseWaterData();
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        // Vercel CDN caches the upstream scrape for 60s, serves stale up to 5 min while revalidating.
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? 'Unknown error' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
