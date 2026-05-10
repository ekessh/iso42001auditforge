// SPDX-License-Identifier: BUSL-1.1
/**
 * Public entry point for `@auditforge/observability`.
 *
 * Re-exports the sub-modules. Consumers should import from the top of the package; sub-paths
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

export {
  SLO_CATALOG,
  generateRecordingRules,
  generateRecordingRulesYaml,
  registerSloAuxiliaryMetrics,
  resetSloAuxiliaryForTests,
  type SliDefinition,
  type SliKind,
  type RecordingRule,
  type SloMetricBindings,
} from './sli.js';

export {
  redactString,
  redactValue,
  buildRedactor,
  DEFAULT_REDACT_PATTERNS,
  type RedactPattern,
  type RedactOptions,
} from './redact.js';

export {
  parseTraceParent,
  formatTraceParent,
  formatServerTiming,
  buildTraceContextHeaders,
  type TraceParent,
  type ServerTimingEntry,
} from './propagation.js';

export {
  WEB_VITAL_NAMES,
  WEB_VITAL_RATING,
  webVitalSampleSchema,
  webVitalsBatchSchema,
  observabilityErrorSchema,
  observabilityErrorsBatchSchema,
  type WebVitalName,
  type WebVitalSample,
  type WebVitalsBatch,
  type ObservabilityErrorReport,
  type ObservabilityErrorsBatch,
} from './web-vitals-types.js';

export { setupTelemetry, type SetupTelemetryOptions, type TelemetryHandle } from './setup.js';
