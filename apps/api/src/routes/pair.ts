import type { FastifyInstance } from 'fastify';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { signToken } from '../auth.js';

// Emparejamiento del reloj:
// 1. El reloj pide un codigo:            POST /pair/code          (sin token)
// 2. El usuario lo captura en el movil:  POST /pair/confirm       (con token del movil)
// 3. El reloj consulta cada 3 s:         GET  /pair/status/:code  -> recibe su propio token
//
// Los codigos viven en memoria y expiran en 10 minutos. Si la API se reinicia,
// el reloj solo tiene que pedir un codigo nuevo.

const CODE_TTL_MS = 10 * 60 * 1000;

type PairEntry = {
  expiresAt: number;
  token?: string;
};

const codes = new Map<string, PairEntry>();

function newCode(): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    if (!codes.has(code)) return code;
  }
  throw new Error('No se pudo generar un codigo de emparejamiento');
}

function getValid(code: string): PairEntry | undefined {
  const entry = codes.get(code);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    codes.delete(code);
    return undefined;
  }
  return entry;
}

const CodeSchema = z.string().regex(/^\d{6}$/, 'El codigo debe tener 6 digitos');

export async function pairRoutes(app: FastifyInstance) {
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of codes) if (entry.expiresAt < now) codes.delete(code);
  }, 60_000);
  cleanup.unref();

  app.post('/pair/code', async (_request, reply) => {
    const code = newCode();
    const expiresAt = Date.now() + CODE_TTL_MS;
    codes.set(code, { expiresAt });
    return reply.code(201).send({ code, expiresAt: new Date(expiresAt).toISOString() });
  });

  app.post('/pair/confirm', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { code } = z.object({ code: CodeSchema }).parse(request.body);
    const entry = getValid(code);
    if (!entry) return reply.code(404).send({ error: 'Codigo invalido o expirado' });

    entry.token = signToken(app, { sub: request.user.sub, email: request.user.email, device: 'watch' });
    return { ok: true };
  });

  app.get('/pair/status/:code', async (request, reply) => {
    const { code } = z.object({ code: CodeSchema }).parse(request.params);
    const entry = getValid(code);
    if (!entry) return reply.code(404).send({ error: 'Codigo invalido o expirado' });

    if (!entry.token) return { status: 'pending' as const };

    // El token se entrega una sola vez.
    codes.delete(code);
    return { status: 'paired' as const, token: entry.token };
  });
}
