import * as SQLite from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

// Base local del reloj. Todo se guarda aqui primero; la sincronizacion
// (src/sync.ts) sube y baja cambios cuando hay conexion.

export const db = SQLite.openDatabaseSync('wipi.db');

export type LocalVehicle = {
  id: string;
  nickname: string;
  is_default: number;
  updated_at: string;
  deleted_at: string | null;
};

export type LocalSession = {
  id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  level: string | null;
  zone: string | null;
  spot: string | null;
  parked_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type OutboxRow = {
  seq: number;
  entity: 'parking_session' | 'parking_note';
  record_id: string;
  payload: string;
  attempts: number;
};

export async function initDb(): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS vehicles (
      id          TEXT PRIMARY KEY NOT NULL,
      nickname    TEXT NOT NULL,
      is_default  INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS parking_sessions (
      id          TEXT PRIMARY KEY NOT NULL,
      vehicle_id  TEXT NOT NULL,
      latitude    REAL NOT NULL,
      longitude   REAL NOT NULL,
      accuracy_m  REAL,
      level       TEXT,
      zone        TEXT,
      spot        TEXT,
      parked_at   TEXT NOT NULL,
      ended_at    TEXT,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS parking_notes (
      id          TEXT PRIMARY KEY NOT NULL,
      session_id  TEXT NOT NULL,
      body        TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      deleted_at  TEXT
    );

    -- Cambios pendientes de subir, en el orden en que ocurrieron.
    CREATE TABLE IF NOT EXISTS outbox (
      seq        INTEGER PRIMARY KEY AUTOINCREMENT,
      entity     TEXT NOT NULL,
      record_id  TEXT NOT NULL,
      payload    TEXT NOT NULL,
      attempts   INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- Clave/valor: cursor de /sync/pull y fecha de la ultima sincronizacion.
    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);
}

// ---------- Lecturas ----------

export async function getDefaultVehicle(): Promise<LocalVehicle | null> {
  return db.getFirstAsync<LocalVehicle>(
    'SELECT * FROM vehicles WHERE deleted_at IS NULL ORDER BY is_default DESC, nickname ASC LIMIT 1',
  );
}

export async function getActiveSession(): Promise<(LocalSession & { vehicle_nickname: string | null }) | null> {
  return db.getFirstAsync(
    `SELECT s.*, v.nickname AS vehicle_nickname
       FROM parking_sessions s
       LEFT JOIN vehicles v ON v.id = s.vehicle_id
      WHERE s.ended_at IS NULL AND s.deleted_at IS NULL
      ORDER BY s.parked_at DESC
      LIMIT 1`,
  );
}

export async function countPending(): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

export async function getState(key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>('SELECT value FROM sync_state WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setState(key: string, value: string | null): Promise<void> {
  await db.runAsync(
    'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

// ---------- Conversion a formato de la API ----------

function sessionPayload(s: LocalSession) {
  return {
    id: s.id,
    vehicleId: s.vehicle_id,
    source: 'watch' as const,
    latitude: s.latitude,
    longitude: s.longitude,
    accuracyM: s.accuracy_m,
    level: s.level,
    zone: s.zone,
    spot: s.spot,
    parkedAt: s.parked_at,
    endedAt: s.ended_at,
    createdAt: s.created_at,
    updatedAt: s.updated_at,
    deletedAt: s.deleted_at,
  };
}

async function enqueueSession(sessionId: string, now: string): Promise<void> {
  const session = await db.getFirstAsync<LocalSession>('SELECT * FROM parking_sessions WHERE id = ?', sessionId);
  if (!session) return;
  await db.runAsync(
    'INSERT INTO outbox (entity, record_id, payload, created_at) VALUES (?, ?, ?, ?)',
    'parking_session',
    session.id,
    JSON.stringify(sessionPayload(session)),
    now,
  );
}

// ---------- Escrituras (siempre local + outbox) ----------

export type NewParking = {
  vehicleId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  level: string | null;
};

/** Guarda un estacionamiento nuevo y cierra el anterior del mismo vehiculo. */
export async function saveParking(input: NewParking): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const previous = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM parking_sessions WHERE vehicle_id = ? AND ended_at IS NULL AND deleted_at IS NULL',
      input.vehicleId,
    );
    for (const row of previous) {
      await db.runAsync('UPDATE parking_sessions SET ended_at = ?, updated_at = ? WHERE id = ?', now, now, row.id);
      await enqueueSession(row.id, now);
    }

    await db.runAsync(
      `INSERT INTO parking_sessions
         (id, vehicle_id, latitude, longitude, accuracy_m, level, parked_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      input.vehicleId,
      input.latitude,
      input.longitude,
      input.accuracyM,
      input.level,
      now,
      now,
      now,
    );
    await enqueueSession(id, now);
  });

  return id;
}

/** "Ya recogi el coche". */
export async function endParking(sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE parking_sessions SET ended_at = ?, updated_at = ? WHERE id = ? AND ended_at IS NULL',
      now,
      now,
      sessionId,
    );
    await enqueueSession(sessionId, now);
  });
}

/** Borra todo lo local (al desemparejar el reloj). */
export async function clearLocalData(): Promise<void> {
  await db.execAsync(`
    DELETE FROM outbox;
    DELETE FROM parking_notes;
    DELETE FROM parking_sessions;
    DELETE FROM vehicles;
    DELETE FROM sync_state;
  `);
}
