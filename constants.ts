// API Configuration
// NOTE: Ideally these should be in process.env, but for the purpose of this generated app, 
// we assume they are injected or the user will replace them.

export const TARGET_URL = 'https://allrivers.info/gauge/shebsh-grigoryevskaya/waterlevel';

// ProTalk Config
export const PROTALK_API_URL = 'https://api.pro-talk.ru/api/v1.0';
export const PROTALK_BOT_TOKEN = process.env.REACT_APP_PROTALK_TOKEN || 'rLTltTA1ib0SZbGK78M7IlVaZs9fov7C'; 
export const PROTALK_BOT_ID = process.env.REACT_APP_PROTALK_BOT_ID || '53194';
export const PROTALK_CHAT_ID = 'shebsh_monitor_001';

// Supabase Config
// Derived from dashboard URL: https://supabase.com/dashboard/project/puxxkpsfeebtpnhecpyd
export const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://puxxkpsfeebtpnhecpyd.supabase.co';
export const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1eHhrcHNmZWVidHBuaGVjcHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzcxODUsImV4cCI6MjA4NTYxMzE4NX0.v-JvM000nUMGrBK5UyUxc0nVtTeBoX9NpmGe5VFkfMo';
export const SUPABASE_TABLE = 'water_levels';
