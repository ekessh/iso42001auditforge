// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema, UuidSchema } from '@auditforge/shared';
import { InterviewLibraryEntrySchema } from './entry.js';
import { ApplicableModeSchema, InterviewRoleSchema } from './role.js';

export const ComposeOptionsSchema = z.object({
  engagementId: UuidSchema,
  roles: z.array(InterviewRoleSchema).min(1),
  clauses: z.array(NonEmptyStringSchema).default([]),
  /** Total budget for the composed plan, in minutes. */
  durationMinutes: z.number().int().min(1).max(600),
  mode: ApplicableModeSchema.default('audit'),
  /** Optional auditor-supplied per-clause focus weights. */
  clauseFocus: z.record(NonEmptyStringSchema, z.number().min(0).max(10)).default({}),
});
export type ComposeOptions = z.infer<typeof ComposeOptionsSchema>;

export const InterviewPlanItemSchema = z.object({
  entry: InterviewLibraryEntrySchema,
  /** Score the composer used to rank this item; useful for explainability. */
  score: z.number(),
});
export type InterviewPlanItem = z.infer<typeof InterviewPlanItemSchema>;

export const InterviewPlanSchema = z.object({
  engagementId: UuidSchema,
  totalDurationMinutes: z.number().int().nonnegative(),
  items: z.array(InterviewPlanItemSchema),
  /** Coverage report: clause -> count of selected questions touching it. */
  coverage: z.record(NonEmptyStringSchema, z.number().int().nonnegative()),
});
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;
