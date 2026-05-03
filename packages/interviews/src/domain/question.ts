// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { NonEmptyStringSchema } from '@auditforge/shared';

export const Iso42001ClauseSchema = z.enum([
  '4',
  '4.1',
  '4.2',
  '4.3',
  '4.4',
  '5',
  '5.1',
  '5.2',
  '5.3',
  '6',
  '6.1',
  '6.2',
  '6.3',
  '7',
  '7.1',
  '7.2',
  '7.3',
  '7.4',
  '7.5',
  '8',
  '8.1',
  '8.2',
  '8.3',
  '9',
  '9.1',
  '9.2',
  '9.3',
  '10',
  '10.1',
  '10.2',
]);
export type Iso42001Clause = z.infer<typeof Iso42001ClauseSchema>;

export const AnnexAControlFamilySchema = z.enum([
  'A.2',
  'A.3',
  'A.4',
  'A.5',
  'A.6',
  'A.7',
  'A.8',
  'A.9',
  'A.10',
]);
export type AnnexAControlFamily = z.infer<typeof AnnexAControlFamilySchema>;

export const AiSystemTypeSchema = z.enum([
  'LLM',
  'predictive_ML',
  'agent',
  'RAG',
  'multi_agent',
  'training_pipeline',
  'MCP',
  'vector_DB',
]);
export type AiSystemType = z.infer<typeof AiSystemTypeSchema>;

export const StakeholderRoleSchema = z.enum([
  'developer',
  'data_scientist',
  'MLOps',
  'business_owner',
  'compliance',
]);
export type StakeholderRole = z.infer<typeof StakeholderRoleSchema>;

export const QuestionAxisSchema = z.enum([
  'clause',
  'annex',
  'aiSystemType',
  'role',
]);
export type QuestionAxis = z.infer<typeof QuestionAxisSchema>;

export const ExpectedEvidenceTypeSchema = z.enum([
  'policy',
  'procedure',
  'record',
  'log',
  'screenshot',
  'dataset',
  'model_card',
  'risk_register',
  'sbom',
  'training_record',
  'incident_record',
  'meeting_minutes',
  'config',
  'test_report',
  'audit_report',
  'contract',
]);
export type ExpectedEvidenceType = z.infer<typeof ExpectedEvidenceTypeSchema>;

export const InterviewQuestionSchema = z.object({
  id: NonEmptyStringSchema,
  text: NonEmptyStringSchema,
  intentRationale: NonEmptyStringSchema,
  expectedEvidenceTypes: z.array(ExpectedEvidenceTypeSchema).min(1),
  mappedClauses: z.array(Iso42001ClauseSchema),
  mappedControls: z.array(AnnexAControlFamilySchema).optional(),
  followUps: z.array(NonEmptyStringSchema),
  axis: QuestionAxisSchema,
  aiSystemTypes: z.array(AiSystemTypeSchema).optional(),
  stakeholderRoles: z.array(StakeholderRoleSchema).optional(),
  /** `true` if this question is curated/library; `false` for ad-hoc auditor-added. */
  curated: z.boolean().default(true),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
