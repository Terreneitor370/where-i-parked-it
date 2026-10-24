import mysql from 'mysql2/promise';
import { env } from './env.js';

// Todas las fechas se guardan y se leen en UTC.
export const pool = mysql.createPool({
  uri: env.DATABASE_URL,
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
