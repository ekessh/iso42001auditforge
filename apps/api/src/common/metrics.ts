// SPDX-License-Identifier: BUSL-1.1
/**
 * Re-exports the canonical metrics registry from `@auditforge/observability`.
 *
 * Historical names (`metricsRegistry`, `httpRequests`, `httpLatencyMs`, `ledgerEvents`) are kept
 * as thin aliases on top of the shared bundle so that existing callers do not need to be touched
 * while the codebase migrates to the new metric names.
 */
import { getMetrics, getRegistry, hashIdToBucket } from '@auditforge/observability';

const m = getMetrics();

/** Canonical prom-client registry. Use this anywhere you previously created your own. */
export const metricsRegistry = getRegistry();

/** Histogram for HTTP request duration (ms). Replaces the old per-app `httpLatencyMs`. */
export const httpLatencyMs = m.requestDuration;

/**
 * Backward-compatible counter alias. The new world favours observing the histogram +
 * `ledgerEmitTotal`. We keep the symbol so legacy imports keep compiling, but it's now an alias
 * for the canonical `ledger_emit_total` series.
 */
export const ledgerEvents = m.ledgerEmitTotal;

/**
 * Used to be a stand-alone counter; equivalent information is now derived from the
 * `auditforge_http_request_duration_ms` histogram count. Re-exported for source compatibility.
 */
export const httpRequests = m.requestDuration;

/** Helper for hashing tenant ids before they are used as Prom labels. */
export const hashFirmIdForLabel = (firmId: string): string => hashIdToBucket(firmId, 64);

export { getMetrics };
