// Aplica db/schema.sql a la base de DATABASE_URL.
// Uso: npm run db:init   (local sin Docker, o la base de Railway)
// Es seguro repetirlo: todas las tablas usan CREATE TABLE IF NOT EXISTS.
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { env } from '../env.js';

const schemaPath = new URL('../../db/schema.sql', import.meta.url);
const sql = await readFile(schemaPath, 'utf8');

const connection = await mysql.createConnection({ uri: env.DATABASE_URL, multipleStatements: true });
try {
  await connection.query(sql);
  console.log('Esquema aplicado correctamente.');
} finally {
  await connection.end();
}
