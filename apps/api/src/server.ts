import Fastify from 'fastify';
import { ZodError } from 'zod';
import { env } from './env.js';
import { pool } from './db.js';
import { registerAuth } from './auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { vehicleRoutes } from './routes/vehicles.js';
import { parkingRoutes } from './routes/parking.js';
import { pairRoutes } from './routes/pair.js';
import { syncRoutes } from './routes/sync.js';

const app = Fastify({ logger: true });

app.setErrorHandler((error, request, reply) => {
  if (error instanceof ZodError) {
    return reply.code(400).send({
      error: 'Datos invalidos',
      issues: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  const statusCode = (error as { statusCode?: number }).statusCode;
  if (statusCode && statusCode < 500) {
    return reply.code(statusCode).send({ error: (error as Error).message });
  }
  request.log.error(error);
  return reply.code(500).send({ error: 'Error interno del servidor' });
});

await registerAuth(app);
await app.register(healthRoutes);
await app.register(authRoutes);
await app.register(pairRoutes);
await app.register(vehicleRoutes);
await app.register(parkingRoutes);
await app.register(syncRoutes);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
