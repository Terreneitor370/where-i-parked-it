// URL de la API. Se define en apps/mobile/.env (ver .env.example).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
