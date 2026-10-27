import mysql from 'mysql2/promise';
import { env } from './env.js';

/**
 * Opciones de conexion a partir de DATABASE_URL.
 *
 * Las bases en la nube (Aiven) entregan URLs con ?ssl-mode=REQUIRED, un parametro
 * que mysql2 no entiende. Se quita de la URL y el SSL se activa aqui.
 */
export function connectionConfig(): { uri: string; ssl?: { ca?: string; rejectUnauthorized: boolean } } {
  const url = new URL(env.DATABASE_URL);
  const sslMode = url.searchParams.get('ssl-mode');
  url.searchParams.delete('ssl-mode');

  const useSsl = env.DATABASE_SSL ?? (sslMode !== null && sslMode.toUpperCase() !== 'DISABLED');
  if (!useSsl) return { uri: url.toString() };

  // Render guarda variables de varias lineas tal cual; si el CA llega con "\n" literales, se corrigen.
  const ca = env.DATABASE_CA?.replace(/\\n/g, '\n');
  return { uri: url.toString(), ssl: ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } };
}

// Todas las fechas se guardan y se leen en UTC.
export const pool = mysql.createPool({
  ...connectionConfig(),
  timezone: 'Z',
  connectionLimit: 10,
  decimalNumbers: true,
});

/** Convierte un ISO 8601 (o null) en Date para MySQL. */
export function toDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha invalida: ${value}`);
  }
  return date;
}

/** Convierte un Date de MySQL en ISO 8601 (o null) para el cliente. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
