import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, toDate } from '../db.js';
import { type NoteRow, type SessionRow, type VehicleRow, noteToJson, sessionToJson } from '../mappers.js';

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const CreateParkingBody = z.object({
  id: z.uuid().optional(),
  vehicleId: z.uuid(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracyM: z.number().nonnegative().nullish(),
  level: optionalText(20),
  zone: optionalText(30),
  spot: optionalText(20),
  note: optionalText(500),
  parkedAt: z.iso.datetime().optional(),
});

const ListQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  vehicleId: z.uuid().optional(),
});

const IdParams = z.object({ id: z.uuid() });
const NoteBody = z.object({ body: z.string().trim().min(1).max(500) });

const SESSION_SELECT = `
  SELECT s.*, v.nickname AS vehicle_nickname
    FROM parking_sessions s
    JOIN vehicles v ON v.id = s.vehicle_id`;

/** Agrega a cada sesion sus notas (sin borradas). */
async function withNotes(rows: SessionRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [notes] = await pool.query<NoteRow[]>(
    'SELECT * FROM parking_notes WHERE session_id IN (?) AND deleted_at IS NULL ORDER BY created_at ASC',
    [ids],
  );
  return rows.map((row) => ({
    ...sessionToJson(row),
    notes: notes.filter((note) => note.session_id === row.id).map(noteToJson),
  }));
}

export async function parkingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Historial, mas reciente primero.
  app.get('/parking', async (request) => {
    const query = ListQuery.parse(request.query);
    const params: unknown[] = [request.user.sub];
    let filter = '';
    if (query.vehicleId) {
      filter = ' AND s.vehicle_id = ?';
      params.push(query.vehicleId);
    }
    params.push(query.limit);

    const [rows] = await pool.query<SessionRow[]>(
      `${SESSION_SELECT}
        WHERE s.user_id = ? AND s.deleted_at IS NULL${filter}
        ORDER BY s.parked_at DESC
        LIMIT ?`,
      params,
    );
    return { sessions: await withNotes(rows) };
  });

  // Estacionamientos sin recoger (ended_at NULL), uno o mas por vehiculo.
  app.get('/parking/active', async (request) => {
    const [rows] = await pool.query<SessionRow[]>(
      `${SESSION_SELECT}
        WHERE s.user_id = ? AND s.deleted_at IS NULL AND s.ended_at IS NULL
        ORDER BY s.parked_at DESC`,
      [request.user.sub],
    );
    return { sessions: await withNotes(rows) };
  });

  // Guardar estacionamiento desde el telefono.
  app.post('/parking', async (request, reply) => {
    const userId = request.user.sub;
    const body = CreateParkingBody.parse(request.body);

    const [vehicles] = await pool.query<VehicleRow[]>(
      'SELECT id FROM vehicles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [body.vehicleId, userId],
    );
    if (vehicles.length === 0) return reply.code(404).send({ error: 'Vehiculo no encontrado' });

    const now = new Date();
    const parkedAt = toDate(body.parkedAt) ?? now;
    const id = body.id ?? randomUUID();

    // Un vehiculo solo puede estar en un lugar: se cierra el estacionamiento anterior.
    await pool.query(
      `UPDATE parking_sessions SET ended_at = ?, updated_at = ?
        WHERE vehicle_id = ? AND user_id = ? AND ended_at IS NULL AND deleted_at IS NULL`,
      [parkedAt, now, body.vehicleId, userId],
    );

    await pool.query(
      `INSERT INTO parking_sessions
         (id, user_id, vehicle_id, source, latitude, longitude, accuracy_m, level, zone, spot, parked_at, created_at, updated_at)
       VALUES (?, ?, ?, 'phone', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        body.vehicleId,
        body.latitude,
        body.longitude,
        body.accuracyM ?? null,
        body.level ?? null,
        body.zone ?? null,
        body.spot ?? null,
        parkedAt,
        now,
        now,
      ],
    );

    if (body.note) {
      await pool.query(
        'INSERT INTO parking_notes (id, session_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [randomUUID(), id, userId, body.note, now, now],
      );
    }

    const [rows] = await pool.query<SessionRow[]>(`${SESSION_SELECT} WHERE s.id = ?`, [id]);
    const [session] = await withNotes(rows);
    return reply.code(201).send({ session });
  });

  // "Ya recogi el coche".
  app.patch('/parking/:id/end', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = IdParams.parse(request.params);
    const now = new Date();

    const [result] = await pool.query(
      `UPDATE parking_sessions SET ended_at = ?, updated_at = ?
        WHERE id = ? AND user_id = ? AND ended_at IS NULL AND deleted_at IS NULL`,
      [now, now, id, userId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return reply.code(404).send({ error: 'Estacionamiento activo no encontrado' });
    }
    return reply.code(204).send();
  });

  // Agregar una nota a un estacionamiento.
  app.post('/parking/:id/notes', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = IdParams.parse(request.params);
    const body = NoteBody.parse(request.body);

    const [sessions] = await pool.query<SessionRow[]>(
      'SELECT id FROM parking_sessions WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [id, userId],
    );
    if (sessions.length === 0) return reply.code(404).send({ error: 'Estacionamiento no encontrado' });

    const now = new Date();
    const noteId = randomUUID();
    await pool.query(
      'INSERT INTO parking_notes (id, session_id, user_id, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [noteId, id, userId, body.body, now, now],
    );
    const [notes] = await pool.query<NoteRow[]>('SELECT * FROM parking_notes WHERE id = ?', [noteId]);
    return reply.code(201).send({ note: notes[0] ? noteToJson(notes[0]) : null });
  });
}
