import { WaterRecord } from '../types';

// Remote history snapshot maintained by the daily GitHub Actions job.
// Local writes (manual "Обновить") are kept in localStorage and merged
// with the remote on read.
const HISTORY_URL = '/history.json';
const LOCAL_KEY = 'water_levels_local';

let remoteCache: WaterRecord[] | null = null;

const fetchRemote = async (): Promise<WaterRecord[]> => {
  if (remoteCache) return remoteCache;
  try {
    const res = await fetch(HISTORY_URL, { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    remoteCache = Array.isArray(data) ? data : [];
    return remoteCache;
  } catch {
    return [];
  }
};

const readLocal = (): WaterRecord[] => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocal = (records: WaterRecord[]): void => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(records));
};

const timeOf = (r: WaterRecord): number =>
  r.created_at ? new Date(r.created_at).getTime() : 0;

const merge = (remote: WaterRecord[], local: WaterRecord[]): WaterRecord[] => {
  // Dedupe by created_at; remote wins on collision since the cron job is canonical.
  const byTimestamp = new Map<string, WaterRecord>();
  for (const r of [...local, ...remote]) {
    if (r.created_at) byTimestamp.set(r.created_at, r);
  }
  return Array.from(byTimestamp.values()).sort((a, b) => timeOf(a) - timeOf(b));
};

export const fetchWaterHistory = async (): Promise<WaterRecord[]> => {
  const [remote, local] = await Promise.all([fetchRemote(), Promise.resolve(readLocal())]);
  return merge(remote, local);
};

export const fetchLatestRecord = async (): Promise<WaterRecord | null> => {
  const all = await fetchWaterHistory();
  return all.length ? all[all.length - 1] : null;
};

export const saveWaterRecord = async (record: WaterRecord): Promise<void> => {
  const local = readLocal();
  const id = local.reduce((m, r) => Math.max(m, r.id ?? 0), 0) + 1;
  local.push({ ...record, id, created_at: new Date().toISOString() });
  writeLocal(local);
};
