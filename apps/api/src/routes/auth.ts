import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db.js';
import { signToken } from '../auth.js';

const RegisterBody = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres'),
  displayName: z.string().trim().min(1).max(100),
});

const LoginBody = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(1),
});

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
};

function publicUser(row: Pick<UserRow, 'id' | 'email' | 'display_name'>) {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/register', async (request, reply) => {
    const body = RegisterBody.parse(request.body);

    const [existing] = await pool.query<UserRow[]>('SELECT id FROM users WHERE email = ?', [body.email]);
    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Ese correo ya esta registrado' });
    }

    const id = randomUUID();
    const passwordHash = await bcrypt.hash(body.password, 10);
    await pool.query('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)', [
      id,
      body.email,
      passwordHash,
      body.displayName,
    ]);

    const token = signToken(app, { sub: id, email: body.email, device: 'phone' });
    return reply.code(201).send({ token, user: { id, email: body.email, displayName: body.displayName } });
  });

  app.post('/auth/login', async (request, reply) => {
    const body = LoginBody.parse(request.body);

    const [rows] = await pool.query<UserRow[]>('SELECT * FROM users WHERE email = ?', [body.email]);
    const user = rows[0];
    const valid = user ? await bcrypt.compare(body.password, user.password_hash) : false;
    if (!user || !valid) {
      return reply.code(401).send({ error: 'Correo o contrasena incorrectos' });
    }

    const token = signToken(app, { sub: user.id, email: user.email, device: 'phone' });
    return { token, user: publicUser(user) };
  });

  app.get('/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const [rows] = await pool.query<UserRow[]>('SELECT id, email, display_name FROM users WHERE id = ?', [
      request.user.sub,
    ]);
    const user = rows[0];
    if (!user) return reply.code(404).send({ error: 'Usuario no encontrado' });
    return { user: publicUser(user), device: request.user.device };
  });
}
