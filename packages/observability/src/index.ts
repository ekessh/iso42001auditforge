// SPDX-License-Identifier: BUSL-1.1
/**
 * Public entry point for `@auditforge/observability`.
 *
 * Re-exports the four sub-modules. Consumers should import from the top of the package; sub-paths
 * (`@auditforge/observability/otel`, etc.) are also valid via the `exports` map but are intended
 * for callers that want to keep their dep graph minimal (e.g. CLI tools).
 */
export {
  initOtel,
  shutdownOtel,
  isOtelStarted,
  getSamplerRatio,
  type InitOtelOptions,
} from './otel.js';

export {
  createLogger,
  DEFAULT_REDACT_PATHS,
  type CreateLoggerOptions,
} from './logger.js';

export {
  getMetrics,
  getRegistry,
  hashIdToBucket,
  resetMetricsForTests,
  type Metrics,
  type Metric,
} from './metrics.js';

export {
  withSpan,
  withCriticalSpan,
  SpanNames,
  type WithSpanOptions,
} from './spans.js';

export {
  attachLedgerEventIdToActiveSpan,
  takeLedgerEventIdForLog,
  readActiveTraceId,
  runWithCorrelationFrame,
  _setPendingLedgerEventIdForTest,
} from './correlate.js';
