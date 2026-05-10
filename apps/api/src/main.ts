// SPDX-License-Identifier: BUSL-1.1
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger as PinoLogger } from 'nestjs-pino';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/config.schema.js';
import { startOtel } from './otel.js';

const SERVICE_VERSION = process.env['npm_package_version'] ?? '0.0.0';

async function bootstrap(): Promise<void> {
  const cfg = loadConfig();
  // Shared @auditforge/observability init — reads OTEL_* env (alias-resolved by config.schema)
  // and brings up the Node SDK with auto-instrumentations + parent-based ratio sampler.
  startOtel(cfg, SERVICE_VERSION);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, requestIdHeader: 'x-request-id', genReqId: () => crypto.randomUUID() }),
    { bufferLogs: true },
  );
  app.useLogger(app.get(PinoLogger));
  app.enableVersioning();

  await app.register(fastifyHelmet as unknown as Parameters<typeof app.register>[0], {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
  });
  await app.register(fastifyCookie as unknown as Parameters<typeof app.register>[0], { secret: cfg.SESSION_SECRET });
  await app.register(fastifyMultipart as unknown as Parameters<typeof app.register>[0], { limits: { fileSize: 5 * 1024 * 1024 * 1024 } });

  const swagger = new DocumentBuilder()
    .setTitle('AuditForge ISO 42001 API')
    .setDescription('NestJS modular monolith API for ISO/IEC 42001 lead auditors')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addCookieAuth('auditforge_session')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'idempotency-key' }, 'idempotency-key')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'x-webauthn-attestation' }, 'webauthn')
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup('docs', app, doc);
  app.getHttpAdapter().get('/openapi.json', (_req, reply) => {
    void reply.header('content-type', 'application/json').send(doc);
  });

  if (process.env.EMIT_OPENAPI === '1') {
    await writeFile(path.resolve('apps/api/openapi/generated.json'), JSON.stringify(doc, null, 2));
  }

  app.enableShutdownHooks();
  // Ensure OTel SDK shutdown is awaited during the graceful window so in-flight batch exports
  // are not dropped on rolling deploy (addresses MEDIUM-OBS-006).
  const { shutdownOtel } = await import('./otel.js');
  process.once('SIGTERM', () => void shutdownOtel());
  process.once('SIGINT', () => void shutdownOtel());
  await app.listen(cfg.PORT, cfg.HOST);
}

bootstrap().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed', err);
  process.exit(1);
});
