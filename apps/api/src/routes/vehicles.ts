import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db.js';
import { type VehicleRow, vehicleToJson } from '../mappers.js';

const optionalText = (max: number) => z.string().trim().max(max).nullish();

const CreateVehicleBody = z.object({
  id: z.uuid().optional(),
  nickname: z.string().trim().min(1).max(50),
  plate: optionalText(15),
  brand: optionalText(50),
  model: optionalText(50),
  color: optionalText(30),
  isDefault: z.boolean().optional(),
});

const UpdateVehicleBody = CreateVehicleBody.omit({ id: true }).partial();

const IdParams = z.object({ id: z.uuid() });

async function findVehicle(userId: string, id: string) {
  const [rows] = await pool.query<VehicleRow[]>(
    'SELECT * FROM vehicles WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [id, userId],
  );
  return rows[0];
}

async function clearDefault(userId: string, now: Date) {
  await pool.query(
    'UPDATE vehicles SET is_default = FALSE, updated_at = ? WHERE user_id = ? AND is_default = TRUE AND deleted_at IS NULL',
    [now, userId],
  );
}

export async function vehicleRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/vehicles', async (request) => {
    const [rows] = await pool.query<VehicleRow[]>(
      'SELECT * FROM vehicles WHERE user_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC',
      [request.user.sub],
    );
    return { vehicles: rows.map(vehicleToJson) };
  });

  app.post('/vehicles', async (request, reply) => {
    const userId = request.user.sub;
    const body = CreateVehicleBody.parse(request.body);
    const now = new Date();
    const id = body.id ?? randomUUID();

    // El primer vehiculo del usuario queda como predeterminado.
    const [existing] = await pool.query<VehicleRow[]>(
      'SELECT id FROM vehicles WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
      [userId],
    );
    const isDefault = body.isDefault ?? existing.length === 0;
    if (isDefault) await clearDefault(userId, now);

    await pool.query(
      `INSERT INTO vehicles (id, user_id, nickname, plate, brand, model, color, is_default, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, body.nickname, body.plate ?? null, body.brand ?? null, body.model ?? null, body.color ?? null, isDefault, now, now],
    );

    const vehicle = await findVehicle(userId, id);
    return reply.code(201).send({ vehicle: vehicle ? vehicleToJson(vehicle) : null });
  });

  app.patch('/vehicles/:id', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = IdParams.parse(request.params);
    const body = UpdateVehicleBody.parse(request.body);

    const current = await findVehicle(userId, id);
    if (!current) return reply.code(404).send({ error: 'Vehiculo no encontrado' });

    const now = new Date();
    if (body.isDefault) await clearDefault(userId, now);

    await pool.query(
      `UPDATE vehicles
          SET nickname = ?, plate = ?, brand = ?, model = ?, color = ?, is_default = ?, updated_at = ?
        WHERE id = ? AND user_id = ?`,
      [
        body.nickname ?? current.nickname,
        body.plate === undefined ? current.plate : body.plate,
        body.brand === undefined ? current.brand : body.brand,
        body.model === undefined ? current.model : body.model,
        body.color === undefined ? current.color : body.color,
        body.isDefault ?? Boolean(current.is_default),
        now,
        id,
        userId,
      ],
    );

    const vehicle = await findVehicle(userId, id);
    return { vehicle: vehicle ? vehicleToJson(vehicle) : null };
  });

  app.delete('/vehicles/:id', async (request, reply) => {
    const userId = request.user.sub;
    const { id } = IdParams.parse(request.params);
    const now = new Date();

    const [result] = await pool.query(
      'UPDATE vehicles SET deleted_at = ?, updated_at = ?, is_default = FALSE WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
      [now, now, id, userId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) {
      return reply.code(404).send({ error: 'Vehiculo no encontrado' });
    }
    return reply.code(204).send();
  });
}
