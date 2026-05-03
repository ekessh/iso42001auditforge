// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  SemverSchema,
  UuidSchema,
} from '@auditforge/shared';
import { AuditKindSchema } from './enums.js';

/**
 * A single quality-checklist item. Weight is 0..10 (integer); items with
 * weight 0 are advisory and excluded from the weighted score (still counted
 * for response-rate metrics).
 */
export const QualityChecklistItemSchema = z.object({
  id: NonEmptyStringSchema,
  /** Section label, e.g. "Plan adequacy", "Sampling defensibility". */
  section: NonEmptyStringSchema,
  /** Item prompt presented to the reviewer. */
  text: NonEmptyStringSchema,
  /**
   * Optional ISO 17021-1 / ISO 42001 clause anchor. Allows reviewers to jump
   * to the standard text and the corresponding working paper.
   */
  clauseRef: z.string().min(1).max(64).optional(),
  /** 0..10. 0 = advisory; >0 = scored. */
  weight: z.number().int().min(0).max(10),
  guidance: z.string().max(4000).optional(),
  /**
   * Whether NA is allowed for this item. Some items must be answered (e.g.
   * "Did the auditor sign the working paper before issuance?").
   */
  naAllowed: z.boolean().default(true),
  /**
   * If true, fail on this item blocks `approve` until the reviewer overrides
   * with a justification. Default `false` (override always allowed; lenient
   * model — independence is the hard rail, not item-by-item gating).
   */
  blockingOnFail: z.boolean().default(false),
});
export type QualityChecklistItem = z.infer<typeof QualityChecklistItemSchema>;

/**
 * Checklist template. CB customizations clone a base template + record
 * `customizationOf` (provenance). Templates are immutable once published; a
 * customization bumps the semver patch.
 */
export const PeerReviewChecklistSchema = z.object({
  id: NonEmptyStringSchema,
  version: SemverSchema,
  title: NonEmptyStringSchema,
  description: z.string().max(4000).default(''),
  appliesTo: AuditKindSchema,
  /** firmId scope: undefined = global default; UUID = CB-specific override. */
  firmId: UuidSchema.optional(),
  /** If this is a CB customization, the upstream template id+version. */
  customizationOf: z
    .object({ id: NonEmptyStringSchema, version: SemverSchema })
    .optional(),
  items: z.array(QualityChecklistItemSchema).min(1).max(500),
  publishedAt: IsoDateSchema,
  /** If `true`, registry rejects further edits. */
  frozen: z.boolean().default(true),
});
export type PeerReviewChecklist = z.infer<typeof PeerReviewChecklistSchema>;

export type PeerReviewChecklistInput = z.input<typeof PeerReviewChecklistSchema>;
export type QualityChecklistItemInput = z.input<typeof QualityChecklistItemSchema>;
