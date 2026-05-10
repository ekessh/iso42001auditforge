// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

export const InterviewNoteSchema = z.object({
  id: NonEmptyStringSchema,
  sessionId: NonEmptyStringSchema,
  segmentId: z.string().optional(),
  text: NonEmptyStringSchema,
  auditorId: NonEmptyStringSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InterviewNote = z.infer<typeof InterviewNoteSchema>;
