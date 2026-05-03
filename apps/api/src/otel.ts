// SPDX-License-Identifier: BUSL-1.1
/**
 * Thin shim that delegates OTel initialisation to the shared `@auditforge/observability` package.
 *
 * The shim exists for backward compatibility with `main.ts`, which used to call `startOtel()`
 * directly. New code should import from `@auditforge/observability` instead.
 */
import { initOtel, shutdownOtel as shutdownSharedOtel } from '@auditforge/observability';

import type { AppConfig } from './config/config.schema.js';

/**
 * Boot the OTel SDK using the shared init module. No-ops when the OTLP endpoint is unset.
 */
export function startOtel(cfg: AppConfig, serviceVersion?: string): void {
  // Logging into the bootstrap pre-Nest is best-effort; we use console here so the warning
  // appears even when pino is not yet wired.
  if (
    (cfg.NODE_ENV === 'production' || cfg.NODE_ENV === 'staging') &&
    (cfg.OTEL_EXPORTER_OTLP_ENDPOINT === undefined || cfg.OTEL_EXPORTER_OTLP_ENDPOINT.length === 0)
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      '[otel] OTEL_EXPORTER_OTLP_ENDPOINT is unset in %s — distributed tracing is disabled.',
      cfg.NODE_ENV,
    );
  }

  initOtel({
    serviceName: cfg.OTEL_SERVICE_NAME,
    ...(serviceVersion !== undefined ? { serviceVersion } : {}),
    environment: cfg.NODE_ENV,
    ...(cfg.OTEL_EXPORTER_OTLP_ENDPOINT !== undefined
      ? { otlpEndpoint: cfg.OTEL_EXPORTER_OTLP_ENDPOINT }
      : {}),
    sampler: cfg.OTEL_TRACES_SAMPLER_ARG,
    protocol: cfg.OTEL_EXPORTER_OTLP_PROTOCOL,
    component: 'api',
  });
}

/** Awaitable shutdown for use in `app.enableShutdownHooks` lifecycle. */
export async function shutdownOtel(): Promise<void> {
  await shutdownSharedOtel();
}
