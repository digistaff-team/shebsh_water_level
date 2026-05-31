// Гидрологические данные (в метрах, система высот Балтийская)
// НЯ затопления (низкая отметка) - соответствует нижней кромке моста
export const BRIDGE_BOTTOM_EDGE_BSV = 35.160;
// ОЯ затопления (высокая, опасная отметка)
export const HIGH_FLOOD_LEVEL_BSV = 36.160;
// Условный ноль гидропоста
export const GAUGING_STATION_ZERO_BSV = 38.158;

// Уровень моста относительно нуля гидропоста (в сантиметрах)
export const BRIDGE_LEVEL_CM = Math.round(
  (BRIDGE_BOTTOM_EDGE_BSV - GAUGING_STATION_ZERO_BSV) * 100
);
