export enum Trend {
  RISING = 'RISING',
  FALLING = 'FALLING',
  STABLE = 'STABLE'
}

export interface WaterRecord {
  id?: number;
  created_at?: string;
  water_level: number;
  change_24h: number;
  trend: Trend;
}

export interface ExtractedWaterData {
  water_level: number;
  change_24h: number;
}
