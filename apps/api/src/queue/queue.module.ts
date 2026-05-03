// SPDX-License-Identifier: BUSL-1.1
import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis, { type Redis } from 'ioredis';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/config.schema.js';

export const REDIS = Symbol.for('AuditForge.Redis');

export const QUEUE_NAMES = [
  'probe-execution',
  'probe-batch',
  'trace-ingest',
  'evidence-av-scan',
  'evidence-ocr',
  'report-render',
  'archive-freeze',
  'archive-renew',
  'telemetry-rollup',
  'co-auditor-task',
] as const;
export type QueueName = (typeof QUEUE_NAMES)[number];

const queueProviders = QUEUE_NAMES.map((name) => ({
  provide: `QUEUE_${name}`,
  inject: [REDIS],
  useFactory: (connection: Redis): Queue =>
    new Queue(name, {
      connection,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2_000 },
        removeOnComplete: { count: 1_000 },
        removeOnFail: { count: 10_000 },
      },
    }),
}));

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (cfg: AppConfig): Redis =>
        new IORedis(cfg.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true }),
    },
    ...queueProviders,
  ],
  exports: [REDIS, ...queueProviders.map((p) => p.provide)],
})
export class QueueModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}

export function queueToken(name: QueueName): string {
  return `QUEUE_${name}`;
}
