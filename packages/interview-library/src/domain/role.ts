// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

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

export const ALL_INTERVIEW_ROLES: readonly InterviewRole[] = [
  'top_management',
  'ai_system_owner',
  'data_scientist',
  'risk_officer',
  'it_operations',
  'auditee_lead',
  'external_stakeholder',
];

export const ApplicableModeSchema = z.enum(['audit', 'readiness', 'both']);
export type ApplicableMode = z.infer<typeof ApplicableModeSchema>;

export const AiSystemClassSchema = z.enum([
  'LLM',
  'predictive_ML',
  'agent',
  'RAG',
  'multi_agent',
  'training_pipeline',
  'MCP',
  'vector_DB',
  'any',
]);
export type AiSystemClass = z.infer<typeof AiSystemClassSchema>;
