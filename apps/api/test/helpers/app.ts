// SPDX-License-Identifier: BUSL-1.1
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';

export async function buildTestApp(env: Record<string, string> = {}): Promise<NestFastifyApplication> {
  Object.entries({
    NODE_ENV: 'test',
    PORT: '0',
    DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_ACCESS_KEY: 'minio',
    S3_SECRET_KEY: 'minio12345',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef',
    ...env,
  }).forEach(([k, v]) => { process.env[k] = v; });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter(), { logger: false });
  app.enableVersioning();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
