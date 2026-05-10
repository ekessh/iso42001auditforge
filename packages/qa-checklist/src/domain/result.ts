// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

export const ChecklistItemStatusSchema = z.enum(['pass', 'fail', 'overridden', 'skipped']);
export type ChecklistItemStatus = z.infer<typeof ChecklistItemStatusSchema>;

export const ChecklistItemResultSchema = z.object({
  id: NonEmptyStringSchema,
  name: NonEmptyStringSchema,
  status: ChecklistItemStatusSchema,
  reason: z.string().default(''),
  /** Auditor rationale captured when the item was overridden. */
  overrideRationale: z.string().optional(),
});
export type ChecklistItemResult = z.infer<typeof ChecklistItemResultSchema>;

export const ChecklistResultSchema = z.object({
  passed: z.boolean(),
  items: z.array(ChecklistItemResultSchema),
});
export type ChecklistResult = z.infer<typeof ChecklistResultSchema>;
