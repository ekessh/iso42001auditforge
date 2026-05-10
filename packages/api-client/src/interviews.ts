// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const InterviewRoleSchema = z.enum([
  'top_management',
  'ai_system_owner',
  'data_scientist',
  'risk_officer',
  'it_operations',
  'auditee_lead',
  'external_stakeholder',
]);
export type InterviewRole = z.infer<typeof InterviewRoleSchema>;

export const InterviewLibraryEntrySchema = z.object({
  id: z.string(),
  role: InterviewRoleSchema,
  clauseRefs: z.array(z.string()),
  applicableModes: z.array(z.string()),
  aiSystemClasses: z.array(z.string()),
  question: z.string(),
  followUps: z.array(z.string()),
  evidenceToSeek: z.array(z.string()),
  commonPitfalls: z.array(z.string()),
  timeBoxMinutes: z.number(),
  weight: z.number(),
});
export type InterviewLibraryEntry = z.infer<typeof InterviewLibraryEntrySchema>;

export const InterviewLibraryListSchema = z.object({
  items: z.array(InterviewLibraryEntrySchema),
});

export const InterviewPlanItemSchema = z.object({
  entry: InterviewLibraryEntrySchema,
  score: z.number(),
});

export const InterviewPlanSchema = z.object({
  engagementId: z.string(),
  totalDurationMinutes: z.number(),
  items: z.array(InterviewPlanItemSchema),
  coverage: z.record(z.number()),
});
export type InterviewPlan = z.infer<typeof InterviewPlanSchema>;

export interface ListLibraryParams {
  role?: InterviewRole;
  clause?: string;
  mode?: 'audit' | 'readiness' | 'both';
}

export function listLibrary(
  params: ListLibraryParams = {},
  options: ApiFetchOptions = {},
) {
  return apiFetch('/interviews/library', InterviewLibraryListSchema, {
    ...options,
    query: { role: params.role, clause: params.clause, mode: params.mode },
  });
}

export interface ComposePlanBody {
  engagementId: string;
  roles: InterviewRole[];
  clauses?: string[];
  durationMinutes: number;
  mode?: 'audit' | 'readiness' | 'both';
  clauseFocus?: Record<string, number>;
}

export function composePlan(
  body: ComposePlanBody,
  options: ApiFetchOptions<ComposePlanBody> = {},
) {
  return apiFetch('/interviews/plan', InterviewPlanSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
