// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const WorkerConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  REDIS_URL: z.string().url(),
  DATABASE_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default('auditforge-evidence'),

  AGENT_ALLOWED_HOSTS: z.string().default(''),
  PROBE_DEFAULT_CPU_MS: z.coerce.number().int().positive().default(60_000),
  PROBE_DEFAULT_MEM_MB: z.coerce.number().int().positive().default(512),
  PROBE_WALLCLOCK_MS: z.coerce.number().int().positive().default(120_000),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
  WORKER_TENANT_CONCURRENCY: z.coerce.number().int().positive().default(2),
});

export type WorkerConfig = z.infer<typeof WorkerConfigSchema>;

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = WorkerConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid worker config:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }
  return parsed.data;
}
