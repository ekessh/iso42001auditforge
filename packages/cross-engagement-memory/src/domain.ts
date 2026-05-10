// SPDX-License-Identifier: BUSL-1.1
/**
 * Phase 15 cross-engagement memory — anonymized per-firm patterns aggregated
 * over closed engagements. CLAUDE.md hard rule: anonymized — no auditee
 * identifiers, no finding text. Patterns only.
 *
 * Two pattern kinds at launch:
 *   - clause_evidence_failure_rate
 *   - probe_failure_rate
 * The schema is open: dimensions are JSON, but the anonymizer (anonymize.ts)
 * enforces the deny-list before any row is persisted.
 */

import { z } from 'zod';

export const PATTERN_KINDS = [
  'clause_evidence_failure_rate',
  'probe_failure_rate',
] as const;
export type PatternKind = (typeof PATTERN_KINDS)[number];

export const PatternKindSchema = z.enum(PATTERN_KINDS);

export const PatternDimensionsSchema = z
  .record(z.union([z.string(), z.number(), z.boolean()]))
  .refine(
    (d) => Object.keys(d).length <= 16,
    { message: 'pattern.dimensions.too_many_keys (max 16)' },
  );
export type PatternDimensions = z.infer<typeof PatternDimensionsSchema>;

export const CrossEngagementPatternSchema = z.object({
  id: z.string().min(1),
  firmId: z.string().min(1),
  patternKind: PatternKindSchema,
  dimensions: PatternDimensionsSchema,
  sampleSize: z.number().int().nonnegative(),
  observation: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  lastUpdated: z.string().min(1),
});
export type CrossEngagementPattern = z.infer<typeof CrossEngagementPatternSchema>;

export const PatternQuerySchema = z
  .object({
    firmId: z.string().min(1),
    patternKind: PatternKindSchema.optional(),
    scope: z.record(z.string()).optional(),
    limit: z.number().int().min(1).max(200).default(50).optional(),
  })
  .strict();
export type PatternQuery = z.infer<typeof PatternQuerySchema>;

export const ClosedEngagementSnapshotSchema = z.object({
  engagementId: z.string().min(1),
  firmId: z.string().min(1),
  scopeDimensions: z.record(z.string()),
  clauseObservations: z.array(
    z.object({
      clauseId: z.string().min(1),
      status: z.enum(['evidenced', 'partial', 'contradicted', 'untouched', 'na']),
    }),
  ),
  probeOutcomes: z.array(
    z.object({
      probeId: z.string().min(1),
      passed: z.boolean(),
    }),
  ),
});
export type ClosedEngagementSnapshot = z.infer<typeof ClosedEngagementSnapshotSchema>;

export interface PatternRepository {
  upsert(p: CrossEngagementPattern): Promise<void>;
  query(q: PatternQuery): Promise<readonly CrossEngagementPattern[]>;
  /** Return *all* rows for a firm — used by memory.export. */
  exportFirm(firmId: string): Promise<readonly CrossEngagementPattern[]>;
}

export interface AggregatorAuditSink {
  /**
   * Called once per aggregator run with a summary so the API can re-emit a
   * `cross-engagement-memory.aggregated` ledger event.
   */
  onAggregated(summary: {
    readonly firmId: string;
    readonly engagementId: string;
    readonly patternsTouched: number;
    readonly occurredAt: string;
  }): Promise<void>;
}
