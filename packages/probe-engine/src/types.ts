// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { SemverSchema, UuidSchema } from '@auditforge/shared';

/**
 * Probe categories per design Section 3.5 + Annex A linkage.
 */
export const ProbeCategorySchema = z.enum([
  'bias',
  'robustness',
  'injection',
  'leakage',
  'hallucination',
  'toxicity',
  'drift',
  'capability',
  'consent',
  'explainability',
  'fairness',
  'privacy',
  'license',
  'data',
  'provenance',
  'composite',
]);
export type ProbeCategory = z.infer<typeof ProbeCategorySchema>;

/**
 * AiSystem kinds the probe applies to. Mirrors the `ai_systems.kind` taxonomy
 * in the data model: classifier, regressor, generative, RAG, agentic, vision,
 * multimodal, embedding, etc.
 */
export const AiSystemKindSchema = z.enum([
  'classifier-binary',
  'classifier-multiclass',
  'regressor',
  'llm-generative',
  'llm-rag',
  'agentic',
  'vision-classifier',
  'vision-detector',
  'multimodal',
  'embedding',
  'asr',
  'tts',
  'recommender',
  'any',
]);
export type AiSystemKind = z.infer<typeof AiSystemKindSchema>;

export const ProbeExecutionModeSchema = z.enum(['offline', 'live', 'replay']);
export type ProbeExecutionMode = z.infer<typeof ProbeExecutionModeSchema>;

/**
 * Verdict returned by a probe run. The `error` verdict is reserved for
 * sandbox/transport failures, distinct from `inconclusive` (probe ran but
 * could not decide).
 */
export const ProbeVerdictSchema = z.enum([
  'pass',
  'fail',
  'inconclusive',
  'error',
]);
export type ProbeVerdict = z.infer<typeof ProbeVerdictSchema>;

export const ProbeStatusSchema = z.enum([
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'budget-blocked',
]);
export type ProbeStatus = z.infer<typeof ProbeStatusSchema>;

export const ControlMappingSchema = z.object({
  /** ISO/IEC 42001 clause id e.g. "6.1.4". */
  clauses: z.array(z.string().min(1)).default([]),
  /** Annex A control id e.g. "A.5.4". */
  annexA: z.array(z.string().min(1)).default([]),
  /** Other-framework references (NIST AI RMF, OWASP LLM Top 10 etc). */
  external: z
    .array(
      z.object({
        framework: z.string().min(1),
        id: z.string().min(1),
      }),
    )
    .default([]),
});
export type ControlMapping = z.infer<typeof ControlMappingSchema>;

export const ProbeBudgetSchema = z.object({
  /** Minimum number of inference calls a single execution will issue. */
  estimatedCallsMin: z.number().int().nonnegative(),
  /** Best-guess upper bound used for pre-flight checks. */
  estimatedCallsMax: z.number().int().nonnegative(),
  /** Best-guess USD cost when run in live mode against a hosted endpoint. */
  costEstimateUsd: z.number().nonnegative(),
  /** Wall-clock cap (ms) for a single execution. Sandbox enforces this. */
  wallClockMaxMs: z.number().int().positive().default(60_000),
  /** Resident memory cap (MB). Sandbox enforces this. */
  memoryMaxMb: z.number().int().positive().default(512),
  /** CPU time cap (ms). Sandbox enforces this. */
  cpuMaxMs: z.number().int().positive().default(30_000),
});
export type ProbeBudget = z.infer<typeof ProbeBudgetSchema>;

export const ReferenceSchema = z.object({
  title: z.string().min(1),
  /** Optional URL. We never auto-fetch; references are documentation only. */
  url: z.string().url().optional(),
  /** Optional citation key for academic references. */
  citationKey: z.string().min(1).optional(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

/**
 * A probe definition. Every probe in the library exports one of these.
 *
 * `parametersSchema` is supplied as a Zod schema by the probe author and stored
 * on the definition for runtime validation. We carry it as `unknown` here so
 * the public type stays narrow; the runner uses `getParametersSchema()`.
 */
export const ProbeDefinitionMetaSchema = z.object({
  id: z.string().regex(/^P-[A-Z]+-\d{2,3}$/, {
    message: 'Probe id must look like P-<CATEGORY>-<NN> (e.g. P-BIAS-01).',
  }),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2_000),
  version: SemverSchema,
  category: ProbeCategorySchema,
  targetKinds: z.array(AiSystemKindSchema).min(1),
  controls: ControlMappingSchema,
  executionModes: z.array(ProbeExecutionModeSchema).min(1),
  budget: ProbeBudgetSchema,
  references: z.array(ReferenceSchema).default([]),
  /** Path (relative to package root) of the ground-truth fixture file. */
  groundTruthFixturePath: z.string().min(1),
  /** Indicates the probe accepts the same seed for deterministic replay. */
  deterministic: z.boolean().default(true),
  /** True when the probe needs an inference client (live or replay-with-judge). */
  requiresInferenceClient: z.boolean().default(false),
  /** Authoring tags. */
  tags: z.array(z.string().min(1)).default([]),
});
export type ProbeDefinitionMeta = z.infer<typeof ProbeDefinitionMetaSchema>;

/**
 * Evidence artifact produced by a probe execution. Worker stores the artifact
 * in object storage; this struct just carries identifiers and digests.
 */
export const EvidenceArtifactSchema = z.object({
  id: UuidSchema,
  kind: z.enum([
    'raw-response',
    'derived-metric',
    'sample-set',
    'screenshot',
    'trace',
    'fixture',
    'report',
  ]),
  contentType: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** Optional storage URI; resolved by the worker. */
  uri: z.string().min(1).optional(),
  /** Inline payload for tiny artifacts (< 8 kB). */
  inline: z.unknown().optional(),
});
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;

export const ProbeErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean().default(false),
  details: z.record(z.unknown()).default({}),
});
export type ProbeError = z.infer<typeof ProbeErrorSchema>;

export const ProbeExecutionSchema = z.object({
  id: UuidSchema,
  engagementId: UuidSchema,
  probeId: z.string().min(1),
  probeVersion: SemverSchema,
  params: z.record(z.unknown()),
  mode: ProbeExecutionModeSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  status: ProbeStatusSchema,
  verdict: ProbeVerdictSchema,
  /** 0..1 score; meaning is per probe (higher = better unless noted). */
  score: z.number().min(0).max(1).optional(),
  evidenceArtifacts: z.array(EvidenceArtifactSchema).default([]),
  rawResponse: z.unknown().optional(),
  derivedMetrics: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
  errors: z.array(ProbeErrorSchema).default([]),
  /** Seed used to drive the probe's RNG. */
  seed: z.number().int().nonnegative(),
  /** True when the runner used a sandbox stub (unit tests, dev). */
  sandboxStub: z.boolean().default(false),
});
export type ProbeExecution = z.infer<typeof ProbeExecutionSchema>;

/** Audit-ledger event emitted for every probe execution. */
export const ProbeLedgerEventSchema = z.object({
  type: z.literal('probe.executed'),
  executionId: UuidSchema,
  engagementId: UuidSchema,
  probeId: z.string().min(1),
  probeVersion: SemverSchema,
  mode: ProbeExecutionModeSchema,
  verdict: ProbeVerdictSchema,
  score: z.number().min(0).max(1).optional(),
  occurredAt: z.string(),
  paramsHash: z.string().regex(/^[0-9a-f]{64}$/),
  resultHash: z.string().regex(/^[0-9a-f]{64}$/),
  budgetSpentUsd: z.number().nonnegative(),
});
export type ProbeLedgerEvent = z.infer<typeof ProbeLedgerEventSchema>;
