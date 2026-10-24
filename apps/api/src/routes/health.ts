import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';

export async function healthRoutes(app: FastifyInstance) {
  // Sirve para confirmar desde el emulador que la API responde:
  // http://localhost:3000/health (con adb reverse) o http://10.0.2.2:3000/health
  app.get('/health', async () => {
    await pool.query('SELECT 1');
    return { ok: true, time: new Date().toISOString() };
  });
}
