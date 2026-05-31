import { WaterRecord } from '../types';

const STORAGE_KEY = 'water_levels';

const readAll = (): WaterRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (records: WaterRecord[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

const timeOf = (r: WaterRecord): number =>
  r.created_at ? new Date(r.created_at).getTime() : 0;

export const fetchWaterHistory = async (): Promise<WaterRecord[]> =>
  readAll().sort((a, b) => timeOf(a) - timeOf(b));

export const fetchLatestRecord = async (): Promise<WaterRecord | null> => {
  const records = readAll();
  if (records.length === 0) return null;
  return records.reduce((latest, current) =>
    timeOf(current) > timeOf(latest) ? current : latest
  );
};

export const saveWaterRecord = async (record: WaterRecord): Promise<void> => {
  const records = readAll();
  const nextId = records.reduce((max, r) => Math.max(max, r.id ?? 0), 0) + 1;
  records.push({ ...record, id: nextId, created_at: new Date().toISOString() });
  writeAll(records);
};
