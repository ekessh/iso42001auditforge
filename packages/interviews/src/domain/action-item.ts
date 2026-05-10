// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

export const ActionItemStatusSchema = z.enum(['open', 'in_progress', 'closed']);
export type ActionItemStatus = z.infer<typeof ActionItemStatusSchema>;

export const ActionItemSchema = z.object({
  id: NonEmptyStringSchema,
  sessionId: NonEmptyStringSchema,
  description: NonEmptyStringSchema,
  assignedTo: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  status: ActionItemStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActionItem = z.infer<typeof ActionItemSchema>;
