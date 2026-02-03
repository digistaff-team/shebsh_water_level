// API Configuration
// NOTE: Ideally these should be in process.env, but for the purpose of this generated app,
// we assume they are injected or the user will replace them.

export const TARGET_URL = 'https://allrivers.info/gauge/shebsh-grigoryevskaya/waterlevel';

// ProTalk Config
export const PROTALK_API_URL = 'https://api.pro-talk.ru/api/v1.0';
export const PROTALK_CHAT_ID = 'shebsh_monitor_001';

// Supabase Config
export const SUPABASE_TABLE = 'water_levels';

// Гидрологические данные (в метрах, система высот Балтийская)
// НЯ затопления (низкая отметка) - соответствует нижней кромке моста
export const BRIDGE_BOTTOM_EDGE_BSV = 35.160; 
// ОЯ затопления (высокая, опасная отметка)
export const HIGH_FLOOD_LEVEL_BSV = 36.160;
// Условный ноль гидропоста
export const GAUGING_STATION_ZERO_BSV = 38.158; 

// Уровень моста относительно нуля гидропоста (в сантиметрах)
export const BRIDGE_LEVEL_CM = Math.round((BRIDGE_BOTTOM_EDGE_BSV - GAUGING_STATION_ZERO_BSV) * 100);
