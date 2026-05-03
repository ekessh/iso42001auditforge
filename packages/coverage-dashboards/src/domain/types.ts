// SPDX-License-Identifier: BUSL-1.1
/**
 * Shared dashboard domain types. All shapes are deliberately plain readonly
 * structures (no classes) so payloads round-trip through JSON cleanly for
 * audit-ledger logging.
 */
import { z } from 'zod';
import { IsoDateSchema } from '@auditforge/shared';

export const ClauseStatusSchema = z.enum([
  'evidenced',
  'partial',
  'contradicted',
  'untouched',
  'na',
]);
export type ClauseStatus = z.infer<typeof ClauseStatusSchema>;

export const ClauseFamilySchema = z.enum([
  'main_body',
  'annex_a_2',
  'annex_a_3',
  'annex_a_4',
  'annex_a_5',
  'annex_a_6',
  'annex_a_7',
  'annex_a_8',
  'annex_a_9',
  'annex_a_10',
]);
export type ClauseFamily = z.infer<typeof ClauseFamilySchema>;

export const ClauseStateSchema = z.object({
  clauseId: z.string().min(1).max(64),
  family: ClauseFamilySchema,
  status: ClauseStatusSchema,
  /** Whether the clause is mandatory (main-body 4..10) per ISO 42001. */
  mandatory: z.boolean(),
  /** Whether this clause is in scope per the SoA for this engagement. */
  inScope: z.boolean(),
  /** ISO timestamp of last status update (used for trend windows). */
  lastUpdatedAt: IsoDateSchema.optional(),
  /** Optional rationale required when status === 'na'. */
  naRationale: z.string().min(1).max(2_000).optional(),
});
export type ClauseState = z.infer<typeof ClauseStateSchema>;

/** Statement of Applicability scope: which Annex A clauses are in scope. */
export const SoaScopeSchema = z.object({
  inScopeClauseIds: z.array(z.string().min(1).max(64)),
  /**
   * Optional precomputed lookup map from clauseId -> in/out. When present, the
   * calculator uses this instead of `inScopeClauseIds`. Always represents the
   * exact same data; just denormalised for performance on large catalogs.
   */
  perClause: z.record(z.string(), z.boolean()).optional(),
});
export type SoaScope = z.infer<typeof SoaScopeSchema>;

/** Versioned weight config — round-trippable JSON for ledger logging. */
export const WeightConfigSchema = z.object({
  /** Stable identifier for this configuration. */
  id: z.string().min(1).max(64),
  /** Semver-style version. */
  version: z.string().min(1).max(64),
  /** Default weight for mandatory main-body clauses (4..10). */
  mandatoryWeight: z.number().positive().max(100),
  /** Default weight for in-scope Annex A clauses. */
  annexAWeight: z.number().positive().max(100),
  /** Optional per-clause overrides. */
  perClauseOverrides: z.record(z.string(), z.number().positive().max(100)).optional(),
  /** Per-family override (applied if no per-clause override). */
  perFamilyOverrides: z.record(ClauseFamilySchema, z.number().positive().max(100)).optional(),
  /** Author of the config — written to ledger on change. */
  setBy: z.string().min(1).max(128),
  /** ISO timestamp the config was set / activated. */
  setAt: IsoDateSchema,
});
export type WeightConfig = z.infer<typeof WeightConfigSchema>;

export const DEFAULT_WEIGHT_CONFIG: WeightConfig = Object.freeze({
  id: 'default',
  version: '1.0.0',
  mandatoryWeight: 1.5,
  annexAWeight: 1.0,
  setBy: 'system',
  setAt: '2026-01-01T00:00:00.000Z',
});

export const PerClauseScoreSchema = z.object({
  clauseId: z.string(),
  family: ClauseFamilySchema,
  weight: z.number(),
  status: ClauseStatusSchema,
  score: z.number().min(0).max(1),
  excluded: z.boolean(),
});
export type PerClauseScore = z.infer<typeof PerClauseScoreSchema>;

export const ReadinessResultSchema = z.object({
  overall: z.number().min(0).max(1),
  perFamily: z.record(ClauseFamilySchema, z.number().min(0).max(1)),
  perClause: z.array(PerClauseScoreSchema),
  methodology: WeightConfigSchema,
});
export type ReadinessResult = z.infer<typeof ReadinessResultSchema>;

/** Open-item shape for the `openItemsPanel`. */
export const OpenItemSchema = z.object({
  id: z.string(),
  kind: z.enum([
    'candidate_finding',
    'improvement_item',
    'open_nc',
    'ofi',
  ]),
  clauseId: z.string().nullable(),
  severity: z.enum(['major', 'minor', 'ofi']).nullable(),
  summary: z.string(),
  createdAt: IsoDateSchema,
});
export type OpenItem = z.infer<typeof OpenItemSchema>;

export const TopBlockerSchema = z.object({
  clauseId: z.string(),
  family: ClauseFamilySchema,
  weightedImpact: z.number(),
  status: ClauseStatusSchema,
  recommendedAction: z.string(),
});
export type TopBlocker = z.infer<typeof TopBlockerSchema>;
