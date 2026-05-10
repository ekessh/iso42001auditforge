// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/**
 * AuditForge ISO 42001 Surveillance — domain model.
 *
 * All cross-tenant identifiers are opaque strings; do not parse them.
 * All schemas are strict (extra fields rejected) so that fuzz / malformed
 * inputs cannot smuggle additional state past the ingest boundary.
 */

// ---------------------------------------------------------------------------
// Identifiers & primitives
// ---------------------------------------------------------------------------

const idSchema = z.string().min(1).max(128);
const tenantIdSchema = idSchema;
const streamIdSchema = idSchema;
const payloadIdSchema = idSchema;

/** ISO-8601 timestamp string. */
const isoTimestampSchema = z
  .string()
  .min(20)
  .max(40)
  .refine((s) => !Number.isNaN(Date.parse(s)), { message: 'invalid ISO-8601 timestamp' });

const finiteNumberSchema = z
  .number()
  .refine((n) => Number.isFinite(n), { message: 'must be finite' });

const nonNegativeNumberSchema = finiteNumberSchema.refine((n) => n >= 0, {
  message: 'must be non-negative',
});

const probabilitySchema = finiteNumberSchema.refine((n) => n >= 0 && n <= 1, {
  message: 'must be in [0, 1]',
});

// ---------------------------------------------------------------------------
// Per-metric payload schemas
// ---------------------------------------------------------------------------

export const METRIC_TYPES = [
  'probe_rollup',
  'drift_indicator',
  'incident_rate',
  'latency',
  'cost',
  'model_update',
  'safety_eval',
  'availability',
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

// `discriminatedUnion` requires every branch to be a `ZodObject` (refine
// wrapping returns `ZodEffects`, which the runtime rejects with
// `Cannot read properties of undefined (reading 'type')`). We therefore
// keep the raw object schema here and apply the `passes + failures <= runs`
// invariant via `superRefine` on the union after construction.
export const probeRollupSchema = z
  .object({
    type: z.literal('probe_rollup'),
    probeId: idSchema,
    windowSeconds: z.number().int().positive().max(86_400 * 30),
    runs: z.number().int().nonnegative(),
    passes: z.number().int().nonnegative(),
    failures: z.number().int().nonnegative(),
    passRate: probabilitySchema,
  })
  .strict();

/** Population/feature drift indicator (e.g., PSI, KL, Wasserstein). */
export const driftIndicatorSchema = z
  .object({
    type: z.literal('drift_indicator'),
    feature: z.string().min(1).max(256),
    method: z.enum(['psi', 'kl', 'wasserstein', 'js', 'ks']),
    score: nonNegativeNumberSchema,
    baselineWindowDays: z.number().int().positive().max(3650),
  })
  .strict();

/** Incident rate over a window (per-1k-requests or per-day). */
export const incidentRateSchema = z
  .object({
    type: z.literal('incident_rate'),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    countWindowSeconds: z.number().int().positive().max(86_400 * 30),
    count: z.number().int().nonnegative(),
    perThousandRequests: nonNegativeNumberSchema.optional(),
  })
  .strict();

/** End-to-end latency, in milliseconds. */
export const latencySchema = z
  .object({
    type: z.literal('latency'),
    quantile: z.enum(['p50', 'p90', 'p95', 'p99']),
    valueMs: nonNegativeNumberSchema,
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();

/** Operational cost rollup (USD). */
export const costSchema = z
  .object({
    type: z.literal('cost'),
    component: z.enum(['inference', 'training', 'storage', 'egress', 'total']),
    amountUsd: nonNegativeNumberSchema,
    windowSeconds: z.number().int().positive().max(86_400 * 60),
  })
  .strict();

/** Auditee notifies us a model has been updated. */
export const modelUpdateSchema = z
  .object({
    type: z.literal('model_update'),
    modelId: idSchema,
    fromVersion: z.string().min(1).max(64),
    toVersion: z.string().min(1).max(64),
    changeKind: z.enum(['retrain', 'finetune', 'config', 'rollback']),
  })
  .strict();

/** Safety eval pass-rate (Jailbreak, harmful content, etc.). */
export const safetyEvalSchema = z
  .object({
    type: z.literal('safety_eval'),
    suiteId: idSchema,
    passRate: probabilitySchema,
    sampleSize: z.number().int().nonnegative(),
  })
  .strict();

/** Availability/uptime over the window (0..1). */
export const availabilitySchema = z
  .object({
    type: z.literal('availability'),
    windowSeconds: z.number().int().positive().max(86_400 * 30),
    uptime: probabilitySchema,
  })
  .strict();

/** Discriminated union over all metric payload bodies. */
export const metricBodySchema = z.discriminatedUnion('type', [
  probeRollupSchema,
  driftIndicatorSchema,
  incidentRateSchema,
  latencySchema,
  costSchema,
  modelUpdateSchema,
  safetyEvalSchema,
  availabilitySchema,
]);

export type MetricBody = z.infer<typeof metricBodySchema>;

// ---------------------------------------------------------------------------
// TelemetryPayload (the transport-level signed envelope contents)
// ---------------------------------------------------------------------------

/** A single ingested telemetry event. */
export const telemetryPayloadSchema = z
  .object({
    /** Globally-unique payload id (also used for idempotent dedup). */
    id: payloadIdSchema,
    /** Auditee tenant submitting this event. */
    tenantId: tenantIdSchema,
    /** Logical stream id (e.g., per-engagement, per-system). */
    streamId: streamIdSchema,
    /** ISO-8601 timestamp of the metric measurement. */
    occurredAt: isoTimestampSchema,
    /** Metric body (discriminated union). */
    metric: metricBodySchema,
  })
  .strict();

export type TelemetryPayload = z.infer<typeof telemetryPayloadSchema>;

// ---------------------------------------------------------------------------
// TelemetryStream (registration + state)
// ---------------------------------------------------------------------------

export const telemetryStreamSchema = z
  .object({
    streamId: streamIdSchema,
    tenantId: tenantIdSchema,
    /** Engagement id this stream feeds. */
    engagementId: idSchema,
    /** Stream display name. */
    name: z.string().min(1).max(256),
    /** Per-tenant secret id (the secret value lives in a vault). */
    secretId: idSchema,
    /** Capacity/refill of the per-tenant token bucket. */
    rateLimit: z
      .object({
        capacity: z.number().int().positive().max(100_000),
        refillPerSecond: nonNegativeNumberSchema.refine((n) => n <= 100_000),
      })
      .strict(),
    /** Allowed clock-skew window for replay protection (seconds). */
    replayWindowSeconds: z.number().int().positive().max(3600),
    /** Lifecycle state. */
    status: z.enum(['active', 'paused', 'revoked']),
    createdAt: isoTimestampSchema,
  })
  .strict();

export type TelemetryStream = z.infer<typeof telemetryStreamSchema>;

// ---------------------------------------------------------------------------
// Thresholds + alerting
// ---------------------------------------------------------------------------

export const SEVERITIES = ['info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const COMPARISON_OPS = ['gt', 'gte', 'lt', 'lte'] as const;
export type ComparisonOp = (typeof COMPARISON_OPS)[number];

/**
 * Per-metric threshold config. The evaluator selects values from a metric body
 * via `metricSelector` (a path inside the metric body, e.g., "passRate" for
 * `probe_rollup` or "valueMs" for `latency`).
 *
 * Hysteresis: an alert is raised when the breaching condition is sustained for
 * `enterSamples` consecutive samples, and only cleared after `exitSamples`
 * non-breaching samples. This prevents flap on a noisy stream.
 */
export const thresholdSchema = z
  .object({
    thresholdId: idSchema,
    tenantId: tenantIdSchema,
    streamId: streamIdSchema,
    metricType: z.enum(METRIC_TYPES),
    /** Dot-path inside the metric body (e.g., "passRate"). */
    metricSelector: z.string().min(1).max(64),
    op: z.enum(COMPARISON_OPS),
    /** Trigger an alert when warning breached. */
    warning: finiteNumberSchema.optional(),
    /** Trigger a critical alert when this is breached. Always >=/<= warning. */
    critical: finiteNumberSchema,
    enterSamples: z.number().int().positive().max(1000),
    exitSamples: z.number().int().positive().max(1000),
    /** Rolling window size for evaluator (number of samples retained). */
    windowSize: z.number().int().positive().max(10_000),
  })
  .strict();

export type Threshold = z.infer<typeof thresholdSchema>;

export const surveillanceAlertSchema = z
  .object({
    alertId: idSchema,
    tenantId: tenantIdSchema,
    streamId: streamIdSchema,
    thresholdId: idSchema,
    severity: z.enum(SEVERITIES),
    metricType: z.enum(METRIC_TYPES),
    observedValue: finiteNumberSchema,
    boundary: finiteNumberSchema,
    op: z.enum(COMPARISON_OPS),
    raisedAt: isoTimestampSchema,
    /** Free-form context for the auditor. */
    context: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export type SurveillanceAlert = z.infer<typeof surveillanceAlertSchema>;

// ---------------------------------------------------------------------------
// Risk re-scoring
// ---------------------------------------------------------------------------

export const RISK_LEVELS = ['low', 'moderate', 'elevated', 'high', 'critical'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const riskRescoreSchema = z
  .object({
    rescoreId: idSchema,
    tenantId: tenantIdSchema,
    engagementId: idSchema,
    /** Final composite score in [0,100]. */
    score: finiteNumberSchema.refine((n) => n >= 0 && n <= 100),
    level: z.enum(RISK_LEVELS),
    /** Per-input contributions (deterministic ordering). */
    contributors: z.array(
      z
        .object({
          source: z.string().min(1).max(128),
          weight: finiteNumberSchema,
          delta: finiteNumberSchema,
        })
        .strict(),
    ),
    computedAt: isoTimestampSchema,
  })
  .strict();

export type RiskRescore = z.infer<typeof riskRescoreSchema>;

// ---------------------------------------------------------------------------
// Incident records (per A.5.5)
// ---------------------------------------------------------------------------

export const INCIDENT_KINDS = [
  'safety',
  'security',
  'privacy',
  'bias',
  'misuse',
  'availability',
  'performance',
  'other',
] as const;
export type IncidentKind = (typeof INCIDENT_KINDS)[number];

export const incidentRecordSchema = z
  .object({
    incidentId: idSchema,
    tenantId: tenantIdSchema,
    engagementId: idSchema,
    kind: z.enum(INCIDENT_KINDS),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    /** Short title. */
    title: z.string().min(1).max(256),
    /** Auditee description. */
    summary: z.string().min(1).max(8192),
    occurredAt: isoTimestampSchema,
    reportedAt: isoTimestampSchema,
    /** Reference to AI system / control affected. */
    affectedSystemIds: z.array(idSchema).max(64),
    /** Whether auditee has flagged it as resolved. */
    resolved: z.boolean(),
  })
  .strict();

export type IncidentRecord = z.infer<typeof incidentRecordSchema>;

// ---------------------------------------------------------------------------
// Surveillance scope proposal
// ---------------------------------------------------------------------------

export const surveillanceScopeProposalSchema = z
  .object({
    proposalId: idSchema,
    tenantId: tenantIdSchema,
    engagementId: idSchema,
    /** Controls / clauses to include in the next surveillance audit. */
    scopeItems: z.array(
      z
        .object({
          ref: z.string().min(1).max(128),
          reason: z.enum([
            'open_nc',
            'alert_critical',
            'alert_warning',
            'incident_recent',
            'risk_increase',
            'random_sample',
          ]),
          weight: finiteNumberSchema,
        })
        .strict(),
    ),
    proposedRiskLevel: z.enum(RISK_LEVELS),
    generatedAt: isoTimestampSchema,
  })
  .strict();

export type SurveillanceScopeProposal = z.infer<
  typeof surveillanceScopeProposalSchema
>;

/** Open NC carried into next surveillance window. */
export const openNonconformitySchema = z
  .object({
    ncId: idSchema,
    ref: z.string().min(1).max(128),
    severity: z.enum(['minor', 'major', 'critical']),
    raisedAt: isoTimestampSchema,
  })
  .strict();

export type OpenNonconformity = z.infer<typeof openNonconformitySchema>;
