import { ExtractedWaterData } from '../types';

// Calls the Vercel Edge Function which scrapes AllRivers server-side
// (the page itself doesn't send CORS headers, so we can't hit it from
// the browser directly).
export const fetchWaterDataLive = async (): Promise<ExtractedWaterData> => {
  const res = await fetch('/api/water-level', { cache: 'no-store' });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.error ?? '';
    } catch { /* ignore */ }
    throw new Error(`Не удалось получить данные (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
};
