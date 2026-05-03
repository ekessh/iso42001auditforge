// SPDX-License-Identifier: BUSL-1.1
/* Build-time OpenAPI emitter — bootstraps Nest in a non-listening mode and writes openapi/generated.json */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { AppModule } from '../src/app.module.js';

async function main(): Promise<void> {
  process.env.NODE_ENV = process.env.NODE_ENV ?? 'production';
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://localhost:5432/postgres';
  process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
  process.env.S3_ENDPOINT = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  process.env.S3_ACCESS_KEY = process.env.S3_ACCESS_KEY ?? 'minio';
  process.env.S3_SECRET_KEY = process.env.S3_SECRET_KEY ?? 'minio12345';
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? '0123456789abcdef0123456789abcdef';

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), { logger: false });
  app.enableVersioning();
  const swagger = new DocumentBuilder()
    .setTitle('AuditForge ISO 42001 API')
    .setVersion('1.0.0')
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  const out = path.resolve(process.cwd(), 'openapi', 'generated.json');
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(doc, null, 2));
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`wrote ${out} (${Object.keys(doc.paths ?? {}).length} paths)`);
}

main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
