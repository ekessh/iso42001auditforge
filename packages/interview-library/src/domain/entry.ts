// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';
import {
  AiSystemClassSchema,
  ApplicableModeSchema,
  InterviewRoleSchema,
} from './role.js';

const ClauseRefSchema = z
  .string()
  .regex(/^(?:[4-9]|10|A\.\d+(?:\.\d+)?)(?:\.\d+)*$/, {
    message: 'must be an ISO 42001 clause ref like "5.2", "8.3", or "A.5.4"',
  });
export type ClauseRef = z.infer<typeof ClauseRefSchema>;

export const InterviewLibraryEntrySchema = z.object({
  id: NonEmptyStringSchema,
  role: InterviewRoleSchema,
  clauseRefs: z.array(ClauseRefSchema).min(1),
  applicableModes: z.array(ApplicableModeSchema).min(1),
  aiSystemClasses: z.array(AiSystemClassSchema).default(['any']),
  question: NonEmptyStringSchema,
  followUps: z.array(NonEmptyStringSchema).default([]),
  evidenceToSeek: z.array(NonEmptyStringSchema).default([]),
  commonPitfalls: z.array(NonEmptyStringSchema).default([]),
  /** Per-question time box in minutes. Composer respects this when fitting a plan. */
  timeBoxMinutes: z.number().int().min(1).max(120),
  /** Auditor focus weight; default 1.0. Higher = preferred during composition. */
  weight: z.number().min(0).max(10).default(1),
});
export type InterviewLibraryEntry = z.infer<typeof InterviewLibraryEntrySchema>;

/** Lightweight projection consumed by `@auditforge/search`. */
export const IndexableEntrySchema = z.object({
  id: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  role: InterviewRoleSchema,
  clauseRefs: z.array(ClauseRefSchema),
  modes: z.array(ApplicableModeSchema),
});
export type IndexableEntry = z.infer<typeof IndexableEntrySchema>;
