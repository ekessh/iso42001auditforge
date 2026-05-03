// SPDX-License-Identifier: BUSL-1.1
/**
 * Lightweight claim & attribution shapes consumed by the detectors.
 *
 * The full claim model lives in `@auditforge/audit-memory`. Replicating the
 * minimum surface here keeps the nc-drafter detectors free of upstream
 * coupling so they can be tested with synthetic fixtures.
 */
import { z } from 'zod';
import { IsoDateSchema, UuidSchema } from '@auditforge/shared';
import {
  ClaimIdSchema,
  ClauseIdSchema,
  ControlIdSchema,
  EpisodeIdSchema,
} from './candidate-finding.js';

/** Polarity of a claim about a control or process. */
export const ClaimPolaritySchema = z.enum(['affirms', 'denies', 'unclear']);
export type ClaimPolarity = z.infer<typeof ClaimPolaritySchema>;

/** Optional process maturity descriptor used by the OFI detector. */
export const ProcessMaturitySchema = z.enum([
  'fragile',
  'manual',
  'undocumented',
  'documented',
  'automated',
  'mature',
]);
export type ProcessMaturity = z.infer<typeof ProcessMaturitySchema>;

export const AttributionSchema = z.object({
  clauseId: ClauseIdSchema,
  controlId: ControlIdSchema.nullable(),
  confidence: z.number().min(0).max(1),
});
export type Attribution = z.infer<typeof AttributionSchema>;

export const ClaimSchema = z.object({
  id: ClaimIdSchema,
  engagementId: UuidSchema,
  episodeId: EpisodeIdSchema,
  text: z.string().min(1).max(10_000),
  polarity: ClaimPolaritySchema,
  /**
   * Whether the auditee said the control is implemented (true), explicitly
   * not implemented (false), or didn't say (null). Distinct from polarity
   * because polarity describes the utterance shape (affirms/denies) and this
   * captures the implementation state semantics.
   */
  controlImplemented: z.boolean().nullable(),
  attributions: z.array(AttributionSchema).default([]),
  processMaturity: ProcessMaturitySchema.nullable(),
  /** Engagement-scoped sample/unit ID; populated when claim relates to a
   * particular sampled control execution. */
  sampleUnitId: z.string().min(1).max(128).nullable(),
  /** Whether this claim says the process is functioning (used by OFI signal). */
  functioning: z.boolean().nullable(),
  capturedAt: IsoDateSchema,
});
export type Claim = z.infer<typeof ClaimSchema>;

/** Ordered pair of contradicting claims. */
export const ContradictionPairSchema = z.object({
  earlier: ClaimSchema,
  later: ClaimSchema,
  contradictedClause: ClauseIdSchema,
});
export type ContradictionPair = z.infer<typeof ContradictionPairSchema>;

/** Audit-plan expectation block — what evidence the plan said we'd collect. */
export const ExpectedEvidenceBlockSchema = z.object({
  clauseId: ClauseIdSchema,
  expectedTypes: z.array(z.string().min(1).max(120)).default([]),
  /** Has the relevant interview block ended (auditor-flagged)? */
  blockClosed: z.boolean(),
});
export type ExpectedEvidenceBlock = z.infer<typeof ExpectedEvidenceBlockSchema>;
