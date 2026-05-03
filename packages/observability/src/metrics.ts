// SPDX-License-Identifier: Apache-2.0
/**
 * Canonical AuditForge prom-client registry and the 19 named metrics used across the platform.
 *
 * Cardinality discipline:
 *   - NEVER label by raw firm_id / engagement_id. Use `firm_id_hashed` / `engagement_hashed` (xxhash mod 64).
 *   - Probe and queue labels are pre-validated by callers — keep the allow-list short.
 *   - Default Node runtime metrics are also collected on this registry.
 */
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
  type Metric,
} from 'prom-client';

let registry: Registry | null = null;
let metricsBundle: Metrics | null = null;

const DURATION_BUCKETS_MS = [1, 2, 5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200, 8000, 30_000];
const COST_BUCKETS_USD = [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 25, 100];
const RETRIEVAL_BUCKETS_MS = [5, 10, 25, 50, 100, 200, 400, 800, 1600];

export interface Metrics {
  readonly registry: Registry;

  // 1. API request latency, hashed firm dimension for limited tenant drill-down.
  readonly requestDuration: Histogram<'route' | 'method' | 'status' | 'firm_id_hashed'>;
  // 2. DB query timing.
  readonly dbQueryDuration: Histogram<'query_type' | 'table'>;
  // 3. LLM call latency.
  readonly llmCallDuration: Histogram<'provider' | 'model' | 'task'>;
  // 4. LLM cost in USD.
  readonly llmCallCost: Counter<'provider' | 'model' | 'engagement_hashed'>;
  // 5. Probe execution latency.
  readonly probeDuration: Histogram<'probe_id' | 'mode'>;
  // 6. Probe budget consumption.
  readonly probeBudgetUsed: Gauge<'engagement_hashed'>;
  // 7. Ledger chain verification time.
  readonly ledgerChainVerifyMs: Histogram<string>;
  // 8. Ledger event emit success counter.
  readonly ledgerEmitTotal: Counter<'event_type' | 'status'>;
  // 9. Ledger event emit failure counter.
  readonly ledgerEmitFailures: Counter<'event_type' | 'reason'>;
  // 10. Conversational-engine retrieval latency.
  readonly retrievalLatency: Histogram<'source'>;
  // 11. Per-release attribution precision gauge.
  readonly attributionPrecision: Gauge<'release'>;
  // 12. Per-release claim-extraction F1.
  readonly claimExtractionF1: Gauge<'release'>;
  // 13. Per-release contradiction precision.
  readonly contradictionPrecision: Gauge<'release'>;
  // 14. RLS bypass attempts (any non-zero is page-worthy).
  readonly rlsBypassAttempts: Counter<'table'>;
  // 15. AV scan availability heartbeat.
  readonly avScanEnabled: Gauge<string>;
  // 16. Probe queue depth.
  readonly probeQueueDepth: Gauge<'queue'>;
  // 17. Signature renewal success counter.
  readonly signatureRenewalSuccess: Counter<string>;
  // 18. Signature renewal failure counter.
  readonly signatureRenewalFailure: Counter<'reason'>;
  // 19. Backup age in seconds.
  readonly backupAge: Gauge<string>;
}

/**
 * Returns (and lazily constructs) the canonical metrics registry. Idempotent.
 */
export function getMetrics(): Metrics {
  if (metricsBundle !== null) return metricsBundle;

  const reg = new Registry();
  collectDefaultMetrics({ register: reg });
  registry = reg;

  metricsBundle = {
    registry: reg,

    requestDuration: new Histogram({
      name: 'auditforge_http_request_duration_ms',
      help: 'HTTP request duration in milliseconds.',
      labelNames: ['route', 'method', 'status', 'firm_id_hashed'] as const,
      buckets: DURATION_BUCKETS_MS,
      registers: [reg],
    }),

    dbQueryDuration: new Histogram({
      name: 'auditforge_db_query_duration_ms',
      help: 'Database query duration in milliseconds.',
      labelNames: ['query_type', 'table'] as const,
      buckets: DURATION_BUCKETS_MS,
      registers: [reg],
    }),

    llmCallDuration: new Histogram({
      name: 'auditforge_llm_call_duration_ms',
      help: 'LLM provider call latency in milliseconds.',
      labelNames: ['provider', 'model', 'task'] as const,
      buckets: DURATION_BUCKETS_MS,
      registers: [reg],
    }),

    llmCallCost: new Counter({
      name: 'auditforge_llm_call_cost_usd_total',
      help: 'Cumulative LLM call cost in USD.',
      labelNames: ['provider', 'model', 'engagement_hashed'] as const,
      registers: [reg],
    }),

    probeDuration: new Histogram({
      name: 'auditforge_probe_duration_ms',
      help: 'Probe runner execution time in milliseconds.',
      labelNames: ['probe_id', 'mode'] as const,
      buckets: DURATION_BUCKETS_MS,
      registers: [reg],
    }),

    probeBudgetUsed: new Gauge({
      name: 'auditforge_probe_budget_used_usd',
      help: 'Probe USD budget consumed for an engagement.',
      labelNames: ['engagement_hashed'] as const,
      registers: [reg],
    }),

    ledgerChainVerifyMs: new Histogram({
      name: 'auditforge_ledger_chain_verify_ms',
      help: 'Audit-ledger verifyChain wall-clock time in milliseconds.',
      buckets: DURATION_BUCKETS_MS,
      registers: [reg],
    }),

    ledgerEmitTotal: new Counter({
      name: 'auditforge_ledger_emit_total',
      help: 'Total audit-ledger events emitted.',
      labelNames: ['event_type', 'status'] as const,
      registers: [reg],
    }),

    ledgerEmitFailures: new Counter({
      name: 'auditforge_ledger_emit_failures_total',
      help: 'Audit-ledger emit failures.',
      labelNames: ['event_type', 'reason'] as const,
      registers: [reg],
    }),

    retrievalLatency: new Histogram({
      name: 'auditforge_retrieval_latency_ms',
      help: 'Conversational-engine retrieval latency in milliseconds.',
      labelNames: ['source'] as const,
      buckets: RETRIEVAL_BUCKETS_MS,
      registers: [reg],
    }),

    attributionPrecision: new Gauge({
      name: 'auditforge_attribution_precision',
      help: 'Attribution precision@3 measured per release on the corpus regression suite.',
      labelNames: ['release'] as const,
      registers: [reg],
    }),

    claimExtractionF1: new Gauge({
      name: 'auditforge_claim_extraction_f1',
      help: 'Claim-extraction F1 score per release.',
      labelNames: ['release'] as const,
      registers: [reg],
    }),

    contradictionPrecision: new Gauge({
      name: 'auditforge_contradiction_precision',
      help: 'Contradiction-detection precision per release.',
      labelNames: ['release'] as const,
      registers: [reg],
    }),

    rlsBypassAttempts: new Counter({
      name: 'auditforge_rls_bypass_total',
      help: 'Postgres RLS bypass attempts detected at the DB guard.',
      labelNames: ['table'] as const,
      registers: [reg],
    }),

    avScanEnabled: new Gauge({
      name: 'auditforge_av_scan_enabled',
      help: 'Antivirus scanning availability heartbeat (1 = enabled).',
      registers: [reg],
    }),

    probeQueueDepth: new Gauge({
      name: 'auditforge_probe_queue_depth',
      help: 'BullMQ probe queue depth.',
      labelNames: ['queue'] as const,
      registers: [reg],
    }),

    signatureRenewalSuccess: new Counter({
      name: 'auditforge_signature_renewal_success_total',
      help: 'Successful TSA signature renewals.',
      registers: [reg],
    }),

    signatureRenewalFailure: new Counter({
      name: 'auditforge_signature_renewal_failure_total',
      help: 'Failed TSA signature renewals.',
      labelNames: ['reason'] as const,
      registers: [reg],
    }),

    backupAge: new Gauge({
      name: 'auditforge_backup_age_seconds',
      help: 'Age of the most recent successful Postgres basebackup in seconds.',
      registers: [reg],
    }),
  };

  // Only used internally; expose buckets for tests.
  void COST_BUCKETS_USD;

  return metricsBundle;
}

/** Returns the canonical registry. Constructs the metrics bundle on first call. */
export function getRegistry(): Registry {
  if (registry !== null) return registry;
  return getMetrics().registry;
}

/** Reset the singleton (test helper). */
export function resetMetricsForTests(): void {
  registry = null;
  metricsBundle = null;
}

/**
 * Hash a free-form id to a `0..n-1` bucket label. Used to keep `firm_id` / `engagement_id` cardinality
 * bounded on Prom labels.
 */
export function hashIdToBucket(id: string, buckets = 64): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const bucket = Math.abs(h) % buckets;
  return bucket.toString(10);
}

/** Re-export Metric for callers that compose custom series on the same registry. */
export type { Metric };
