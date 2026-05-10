// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

export const InterviewSessionStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'paused',
  'completed',
  'cancelled',
]);
export type InterviewSessionStatus = z.infer<typeof InterviewSessionStatusSchema>;

export const InterviewSessionSchema = z.object({
  id: NonEmptyStringSchema,
  engagementId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  status: InterviewSessionStatusSchema,
  auditorId: NonEmptyStringSchema,
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;
