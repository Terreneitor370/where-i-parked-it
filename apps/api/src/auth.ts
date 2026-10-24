import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { env } from './env.js';

export type TokenPayload = {
  sub: string; // id del usuario
  email: string;
  device: 'phone' | 'watch';
};

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: TokenPayload;
    user: TokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/** Duracion del token. Sin refresh tokens en esta entrega. */
export const TOKEN_TTL = '30d';

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'No autenticado' });
    }
  });
}

export function signToken(app: FastifyInstance, payload: TokenPayload): string {
  return app.jwt.sign(payload, { expiresIn: TOKEN_TTL });
}
