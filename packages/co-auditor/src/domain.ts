// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const TaskType = z.enum([
  'suggest_questions',
  'detect_gaps',
  'draft_nc',
  'rewrite_section',
  'select_probes',
  'summarize_trace',
]);
export type TaskType = z.infer<typeof TaskType>;

export const InvocationStatus = z.enum(['pending', 'accepted', 'rejected', 'errored']);
export type InvocationStatus = z.infer<typeof InvocationStatus>;

export const CoAuditorInvocation = z.object({
  id: z.string().uuid(),
  firmId: z.string().uuid(),
  engagementId: z.string().uuid(),
  auditorId: z.string().uuid(),
  taskType: TaskType,
  backend: z.enum(['local', 'cloud']),
  consentRecordId: z.string().uuid().nullable(),
  promptHash: z.string().regex(/^[a-f0-9]{64}$/),
  promptInputJson: z.string(),
  generatedOutputJson: z.string().nullable(),
  status: InvocationStatus,
  ledgerEventId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});
export type CoAuditorInvocation = z.infer<typeof CoAuditorInvocation>;
