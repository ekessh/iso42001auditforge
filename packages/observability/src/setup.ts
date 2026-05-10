// SPDX-License-Identifier: BUSL-1.1
/**
 * Convenience high-level API matching the spec contract:
 *   `setupTelemetry({ serviceName, serviceVersion, otlpEndpoint, samplerRatio })`
 *
 * WHY a wrapper: callers want a single call that wires OTel + the metrics registry + the SLI aux
 * series, returns a tracer + logger + metrics handle, and is idempotent across hot reload.
 */
import { trace, type Tracer } from '@opentelemetry/api';
import type { Logger } from 'pino';

import { createLogger, type CreateLoggerOptions } from './logger.js';
import { getMetrics, type Metrics } from './metrics.js';
import { initOtel } from './otel.js';
import { registerSloAuxiliaryMetrics, type SloMetricBindings } from './sli.js';

export interface SetupTelemetryOptions {
  readonly serviceName: string;
  readonly serviceVersion?: string;
  readonly environment?: string;
  readonly otlpEndpoint?: string;
  readonly samplerRatio?: number;
  readonly protocol?: 'http' | 'grpc';
  readonly component?: string;
  readonly logger?: Omit<CreateLoggerOptions, 'serviceName' | 'serviceVersion' | 'environment'>;
  readonly registerShutdownHook?: (handler: () => Promise<void>) => void;
}

export interface TelemetryHandle {
  readonly tracer: Tracer;
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly sli: SloMetricBindings;
  readonly otelStarted: boolean;
}

export function setupTelemetry(opts: SetupTelemetryOptions): TelemetryHandle {
  const otelTracer = initOtel({
    serviceName: opts.serviceName,
    ...(opts.serviceVersion !== undefined ? { serviceVersion: opts.serviceVersion } : {}),
    ...(opts.environment !== undefined ? { environment: opts.environment } : {}),
    ...(opts.otlpEndpoint !== undefined ? { otlpEndpoint: opts.otlpEndpoint } : {}),
    ...(opts.samplerRatio !== undefined ? { sampler: opts.samplerRatio } : {}),
    ...(opts.protocol !== undefined ? { protocol: opts.protocol } : {}),
    ...(opts.component !== undefined ? { component: opts.component } : {}),
    ...(opts.registerShutdownHook !== undefined
      ? { registerShutdownHook: opts.registerShutdownHook }
      : {}),
  });

  const tracer = otelTracer ?? trace.getTracer(opts.serviceName);

  const metrics = getMetrics();
  const sli = registerSloAuxiliaryMetrics(metrics);

  const logger = createLogger({
    serviceName: opts.serviceName,
    ...(opts.serviceVersion !== undefined ? { serviceVersion: opts.serviceVersion } : {}),
    ...(opts.environment !== undefined ? { environment: opts.environment } : {}),
    ...(opts.logger ?? {}),
  });

  return {
    tracer,
    logger,
    metrics,
    sli,
    otelStarted: otelTracer !== null,
  };
}
