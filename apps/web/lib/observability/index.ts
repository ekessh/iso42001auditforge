// SPDX-License-Identifier: BUSL-1.1
/**
 * Public entry for `@auditforge/web/lib/observability`.
 *
 * Single import path so app/layout boots both the web-vitals collector and the error reporter
 * with consistent options.
 */
export { startWebVitalsClient } from './web-vitals.js';
export type { WebVitalsClientOptions } from './web-vitals.js';

export { startErrorReporter } from './error-reporter.js';
export type { ErrorReporterOptions } from './error-reporter.js';

export {
  parseTraceParent,
  formatTraceParent,
  newTraceId,
  newSpanId,
  instrumentFetch,
} from './trace-propagation.js';
export type { TraceParent, TraceAwareFetchOptions } from './trace-propagation.js';

export { redactString } from './redact.js';

export {
  WEB_VITAL_NAMES,
  webVitalSampleSchema,
  webVitalsBatchSchema,
  observabilityErrorSchema,
  observabilityErrorsBatchSchema,
} from './types.js';
export type {
  WebVitalName,
  WebVitalSample,
  WebVitalsBatch,
  ObservabilityErrorReport,
  ObservabilityErrorsBatch,
} from './types.js';
