// URL de la API. Se define en apps/watch/.env (ver .env.example).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// Cada cuanto intenta sincronizar mientras la app esta abierta.
export const SYNC_INTERVAL_MS = 60_000;

// Niveles rapidos para no escribir en el reloj.
export const LEVEL_PRESETS = ['Planta baja', 'Nivel 1', 'Nivel 2', 'Nivel 3', 'Nivel 4', 'Sótano 1', 'Sótano 2'];
