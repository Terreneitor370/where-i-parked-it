import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'Falta DATABASE_URL en .env'),
  // SSL hacia MySQL. Si no se define, se activa solo cuando la URL trae ?ssl-mode=REQUIRED (Aiven).
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  // Certificado CA del proveedor (texto PEM). Opcional: sin el, la conexion va cifrada sin validar el certificado.
  DATABASE_CA: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variables de entorno invalidas:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Copia apps/api/.env.example a apps/api/.env y completa los valores.');
  process.exit(1);
}

export const env = parsed.data;
