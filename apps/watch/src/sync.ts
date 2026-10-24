import NetInfo from '@react-native-community/netinfo';
import { api, ApiError } from './api';
import { db, getState, setState, type OutboxRow } from './db';

// Sincronizacion: primero PUSH (outbox -> API), luego PULL (API -> SQLite).
// Conflictos: gana el registro con updated_at mas reciente (igual que en la API).

const BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;

type PushResponse = { accepted: string[]; rejected: { id: string; reason: string }[] };

type RemoteVehicle = { id: string; nickname: string; isDefault: boolean; updatedAt: string; deletedAt: string | null };
type RemoteSession = {
  id: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  level: string | null;
  zone: string | null;
  spot: string | null;
  parkedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
type RemoteNote = { id: string; sessionId: string; body: string; createdAt: string; updatedAt: string; deletedAt: string | null };
type PullResponse = {
  vehicles: RemoteVehicle[];
  parkingSessions: RemoteSession[];
  parkingNotes: RemoteNote[];
  cursor: string | null;
};

export type SyncResult = { ok: true; pushed: number } | { ok: false; reason: 'offline' | 'unauthorized' | 'error'; message?: string };

let running: Promise<SyncResult> | null = null;

async function push(): Promise<number> {
  let pushed = 0;
  for (;;) {
    const rows = await db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY seq ASC LIMIT ?', BATCH_SIZE);
    if (rows.length === 0) return pushed;

    const changes = rows.map((row) => ({ entity: row.entity, data: JSON.parse(row.payload) }));
    const result = await api<PushResponse>('/sync/push', { method: 'POST', body: { changes } });

    const rejectedIds = new Set(result.rejected.map((r) => r.id));
    await db.withTransactionAsync(async () => {
      for (const row of rows) {
        if (rejectedIds.has(row.record_id)) {
          // Reintenta en la siguiente sincronizacion; despues de 5 fallos se descarta.
          await db.runAsync('UPDATE outbox SET attempts = attempts + 1 WHERE seq = ?', row.seq);
          await db.runAsync('DELETE FROM outbox WHERE seq = ? AND attempts >= ?', row.seq, MAX_ATTEMPTS);
        } else {
          await db.runAsync('DELETE FROM outbox WHERE seq = ?', row.seq);
          pushed++;
        }
      }
    });

    // Si todo el lote fue rechazado, no insistir en bucle.
    if (result.accepted.length === 0) return pushed;
  }
}

async function pull(): Promise<void> {
  const since = await getState('cursor');
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  const data = await api<PullResponse>(`/sync/pull${query}`);

  await db.withTransactionAsync(async () => {
    for (const v of data.vehicles) {
      await db.runAsync(
        `INSERT INTO vehicles (id, nickname, is_default, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           nickname = excluded.nickname, is_default = excluded.is_default,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= vehicles.updated_at`,
        v.id,
        v.nickname,
        v.isDefault ? 1 : 0,
        v.updatedAt,
        v.deletedAt,
      );
    }

    for (const s of data.parkingSessions) {
      await db.runAsync(
        `INSERT INTO parking_sessions
           (id, vehicle_id, latitude, longitude, accuracy_m, level, zone, spot,
            parked_at, ended_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           vehicle_id = excluded.vehicle_id, latitude = excluded.latitude, longitude = excluded.longitude,
           accuracy_m = excluded.accuracy_m, level = excluded.level, zone = excluded.zone, spot = excluded.spot,
           parked_at = excluded.parked_at, ended_at = excluded.ended_at,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= parking_sessions.updated_at`,
        s.id,
        s.vehicleId,
        s.latitude,
        s.longitude,
        s.accuracyM,
        s.level,
        s.zone,
        s.spot,
        s.parkedAt,
        s.endedAt,
        s.createdAt,
        s.updatedAt,
        s.deletedAt,
      );
    }

    for (const n of data.parkingNotes) {
      await db.runAsync(
        `INSERT INTO parking_notes (id, session_id, body, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           body = excluded.body, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= parking_notes.updated_at`,
        n.id,
        n.sessionId,
        n.body,
        n.createdAt,
        n.updatedAt,
        n.deletedAt,
      );
    }
  });

  if (data.cursor) await setState('cursor', data.cursor);
}

/** Sincroniza si hay red. Varias llamadas simultaneas comparten la misma ejecucion. */
export function syncNow(): Promise<SyncResult> {
  if (running) return running;
  running = (async (): Promise<SyncResult> => {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) return { ok: false, reason: 'offline' };
    try {
      const pushed = await push();
      await pull();
      await setState('last_sync_at', new Date().toISOString());
      return { ok: true, pushed };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return { ok: false, reason: 'unauthorized' };
      if (error instanceof TypeError || (error as Error)?.name === 'AbortError') return { ok: false, reason: 'offline' };
      return { ok: false, reason: 'error', message: (error as Error)?.message };
    }
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Sincroniza automaticamente cada vez que vuelve la conexion. Devuelve la funcion para dejar de escuchar. */
export function syncOnReconnect(onDone?: (result: SyncResult) => void): () => void {
  let wasConnected: boolean | null = null;
  return NetInfo.addEventListener((state) => {
    const connected = state.isConnected === true;
    if (connected && wasConnected === false) {
      syncNow().then((result) => onDone?.(result));
    }
    wasConnected = connected;
  });
}
