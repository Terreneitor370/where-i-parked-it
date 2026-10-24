import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { pool, toDate } from '../db.js';
import {
  type NoteRow,
  type SessionRow,
  type VehicleRow,
  noteToJson,
  sessionToJson,
  vehicleToJson,
} from '../mappers.js';

// Sincronizacion offline-first del reloj.
//
// PUSH  POST /sync/push  { changes: [...] }  -> { accepted: [id], rejected: [{ id, reason }] }
//   - Cada cambio trae el registro completo (no diferencias).
//   - Gana el registro con updated_at mas reciente (last-write-wins por registro).
//   - "accepted" incluye cambios aplicados y cambios ignorados por ser mas viejos:
//     en ambos casos el cliente los quita de su outbox.
//   - "rejected" son errores (ej. vehiculo ajeno); el cliente reintenta y luego descarta.
//
// PULL  GET /sync/pull?since=ISO  -> { vehicles, parkingSessions, parkingNotes, cursor }
//   - Devuelve todo lo que cambio en el servidor desde "since" (inclusivo).
//   - El cliente guarda "cursor" y lo manda como "since" la siguiente vez.
//   - Es inclusivo a proposito: un registro repetido no hace dano porque el
//     cliente aplica la misma regla de updated_at.

const isoDate = z.iso.datetime({ offset: true });
const nullableIso = isoDate.nullable().optional();
const optionalText = (max: number) => z.string().trim().max(max).nullish();

const SessionData = z.object({
  id: z.uuid(),
  vehicleId: z.uuid(),
  source: z.enum(['watch', 'phone']).default('watch'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().nullish(),
  level: optionalText(20),
  zone: optionalText(30),
  spot: optionalText(20),
  parkedAt: isoDate,
  endedAt: nullableIso,
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: nullableIso,
});

const NoteData = z.object({
  id: z.uuid(),
  sessionId: z.uuid(),
  body: z.string().trim().min(1).max(500),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: nullableIso,
});

const Change = z.discriminatedUnion('entity', [
  z.object({ entity: z.literal('parking_session'), data: SessionData }),
  z.object({ entity: z.literal('parking_note'), data: NoteData }),
]);

const PushBody = z.object({ changes: z.array(Change).max(500) });
const PullQuery = z.object({ since: isoDate.optional() });

type SessionInput = z.infer<typeof SessionData>;
type NoteInput = z.infer<typeof NoteData>;

// En ON DUPLICATE KEY UPDATE, MySQL asigna de izquierda a derecha:
// updated_at debe ir al final para que las demas columnas comparen contra el valor viejo.
const newer = (table: string, column: string) =>
  `${column} = IF(new.updated_at > ${table}.updated_at AND ${table}.user_id = new.user_id, new.${column}, ${table}.${column})`;

async function upsertSession(userId: string, data: SessionInput): Promise<string | null> {
  const [vehicles] = await pool.query<VehicleRow[]>('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', [
    data.vehicleId,
    userId,
  ]);
  if (vehicles.length === 0) return 'vehicle-not-found';

  const columns = ['vehicle_id', 'latitude', 'longitude', 'accuracy_m', 'level', 'zone', 'spot', 'parked_at', 'ended_at', 'deleted_at', 'updated_at'];
  const t = 'parking_sessions';
  await pool.query(
    `INSERT INTO parking_sessions
       (id, user_id, vehicle_id, source, latitude, longitude, accuracy_m, level, zone, spot,
        parked_at, ended_at, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE ${columns.map((column) => newer(t, column)).join(',\n       ')}`,
    [
      data.id,
      userId,
      data.vehicleId,
      data.source,
      data.latitude,
      data.longitude,
      data.accuracyM ?? null,
      data.level ?? null,
      data.zone ?? null,
      data.spot ?? null,
      toDate(data.parkedAt),
      toDate(data.endedAt),
      toDate(data.createdAt),
      toDate(data.updatedAt),
      toDate(data.deletedAt),
    ],
  );

  // Un vehiculo solo puede estar en un lugar: si esta sesion sigue activa,
  // se cierran las sesiones activas anteriores del mismo vehiculo.
  if (!data.endedAt && !data.deletedAt) {
    const parkedAt = toDate(data.parkedAt);
    await pool.query(
      `UPDATE parking_sessions SET ended_at = ?, updated_at = ?
        WHERE vehicle_id = ? AND user_id = ? AND id <> ?
          AND ended_at IS NULL AND deleted_at IS NULL AND parked_at < ?`,
      [parkedAt, new Date(), data.vehicleId, userId, data.id, parkedAt],
    );
  }
  return null;
}

async function upsertNote(userId: string, data: NoteInput): Promise<string | null> {
  const [sessions] = await pool.query<SessionRow[]>(
    'SELECT id FROM parking_sessions WHERE id = ? AND user_id = ?',
    [data.sessionId, userId],
  );
  // La sesion llega antes que su nota si el cliente respeta el orden del outbox.
  if (sessions.length === 0) return 'session-not-found';

  const columns = ['body', 'deleted_at', 'updated_at'];
  const t = 'parking_notes';
  await pool.query(
    `INSERT INTO parking_notes (id, session_id, user_id, body, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE ${columns.map((column) => newer(t, column)).join(',\n       ')}`,
    [
      data.id,
      data.sessionId,
      userId,
      data.body,
      toDate(data.createdAt),
      toDate(data.updatedAt),
      toDate(data.deletedAt),
    ],
  );
  return null;
}

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/sync/push', async (request) => {
    const userId = request.user.sub;
    const { changes } = PushBody.parse(request.body);

    const accepted: string[] = [];
    const rejected: { id: string; reason: string }[] = [];

    for (const change of changes) {
      try {
        const reason =
          change.entity === 'parking_session'
            ? await upsertSession(userId, change.data)
            : await upsertNote(userId, change.data);
        if (reason) rejected.push({ id: change.data.id, reason });
        else accepted.push(change.data.id);
      } catch (error) {
        request.log.error({ err: error, id: change.data.id }, 'sync push: error al aplicar cambio');
        rejected.push({ id: change.data.id, reason: 'server-error' });
      }
    }

    return { accepted, rejected };
  });

  app.get('/sync/pull', async (request) => {
    const userId = request.user.sub;
    const { since } = PullQuery.parse(request.query);
    const sinceDate = toDate(since) ?? new Date(0);

    const [vehicles] = await pool.query<VehicleRow[]>(
      'SELECT * FROM vehicles WHERE user_id = ? AND server_updated_at >= ?',
      [userId, sinceDate],
    );
    const [sessions] = await pool.query<SessionRow[]>(
      'SELECT * FROM parking_sessions WHERE user_id = ? AND server_updated_at >= ?',
      [userId, sinceDate],
    );
    const [notes] = await pool.query<NoteRow[]>(
      'SELECT * FROM parking_notes WHERE user_id = ? AND server_updated_at >= ?',
      [userId, sinceDate],
    );

    const latest = [...vehicles, ...sessions, ...notes].reduce<Date>(
      (max, row) => (row.server_updated_at > max ? row.server_updated_at : max),
      sinceDate,
    );

    return {
      vehicles: vehicles.map(vehicleToJson),
      parkingSessions: sessions.map(sessionToJson),
      parkingNotes: notes.map(noteToJson),
      cursor: latest.getTime() === 0 ? null : latest.toISOString(),
    };
  });
}
