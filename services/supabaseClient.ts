import { createClient } from '@supabase/supabase-js';
import { SUPABASE_TABLE } from '../constants';
import { WaterRecord } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Initialize the client conditionally to prevent 'supabaseUrl is required' error on load
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export const fetchWaterHistory = async (): Promise<WaterRecord[]> => {
  if (!supabase) {
    console.warn("Supabase not configured. Returning empty history.");
    return [];
  }
  
  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching history:', error);
    if (error.code === '42501' || error.message.includes('row-level security')) {
        throw new Error("Supabase Access Denied: Please create an RLS policy or disable RLS in your table settings.");
    }
    throw error;
  }
  return data as WaterRecord[];
};

export const fetchLatestRecord = async (): Promise<WaterRecord | null> => {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching latest record:', error);
    if (error.code === '42501' || error.message.includes('row-level security')) {
        // Do not throw here to allow app to render with empty state, just log
        console.warn("Could not fetch latest record due to RLS policy.");
        return null;
    }
    throw error;
  }
  
  return data && data.length > 0 ? (data[0] as WaterRecord) : null;
};

export const saveWaterRecord = async (record: WaterRecord): Promise<void> => {
  if (!supabase) {
    throw new Error("Supabase credentials missing. Cannot save data.");
  }

  const { error } = await supabase
    .from(SUPABASE_TABLE)
    .insert([record]);

  if (error) {
    console.error('Error saving record:', error);
    if (error.code === '42501' || error.message.includes('row-level security')) {
        throw new Error("Supabase Write Error: RLS Policy violation. Please run 'create policy ...' in Supabase SQL Editor.");
    }
    throw error;
  }
};