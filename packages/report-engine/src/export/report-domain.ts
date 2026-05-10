// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  Sha256HexSchema,
  UuidSchema,
} from '@auditforge/shared';

export const ReportKindSchema = z.enum(['audit', 'annexA', 'readiness']);
export type ReportKind = z.infer<typeof ReportKindSchema>;

export const ClauseStatusSchema = z.enum([
  'evidenced',
  'partial',
  'contradicted',
  'untouched',
  'na',
]);
export type ClauseStatus = z.infer<typeof ClauseStatusSchema>;

export const FindingKindSchema = z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']);
export type FindingKind = z.infer<typeof FindingKindSchema>;

export const ReportFindingSchema = z.object({
  number: NonEmptyStringSchema,
  kind: FindingKindSchema,
  clauseRef: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  statement: NonEmptyStringSchema,
  rootCause: z.string().optional(),
  evidenceRefs: z.array(NonEmptyStringSchema).default([]),
});
export type ReportFinding = z.infer<typeof ReportFindingSchema>;

export const ReportClauseSchema = z.object({
  ref: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  weight: z.number().nonnegative(),
  status: ClauseStatusSchema,
  rationale: z.string().optional(),
  evidenceCount: z.number().int().nonnegative().default(0),
});
export type ReportClause = z.infer<typeof ReportClauseSchema>;

export const ReportSignerSchema = z.object({
  role: z.enum(['lead_auditor', 'peer_reviewer', 'technical_expert']),
  name: NonEmptyStringSchema,
  credential: z.string().optional(),
});
export type ReportSigner = z.infer<typeof ReportSignerSchema>;

export const ReportAttachmentSchema = z.object({
  name: NonEmptyStringSchema,
  relationship: z.enum(['Source', 'Data', 'Alternative', 'Supplement', 'Unspecified']),
  mimeType: NonEmptyStringSchema,
  description: z.string().optional(),
  bytesBase64: z.string(),
  sha256: Sha256HexSchema,
});
export type ReportAttachment = z.infer<typeof ReportAttachmentSchema>;

export const ReportBaseSchema = z.object({
  reportId: UuidSchema,
  engagementId: UuidSchema,
  firmId: UuidSchema,
  clientLegalName: NonEmptyStringSchema,
  scopeStatement: NonEmptyStringSchema,
  methodologySummary: NonEmptyStringSchema,
  generatedAt: IsoDateSchema,
  signers: z.array(ReportSignerSchema).min(1),
  clauses: z.array(ReportClauseSchema),
  findings: z.array(ReportFindingSchema).default([]),
  attachments: z.array(ReportAttachmentSchema).default([]),
});

export const AuditReportSchema = ReportBaseSchema.extend({
  kind: z.literal('audit'),
  auditEventKind: z.enum(['stage1', 'stage2', 'surveillance', 'recertification']),
  conformitySummary: NonEmptyStringSchema,
});
export type AuditReport = z.infer<typeof AuditReportSchema>;

export const AnnexAReportSchema = ReportBaseSchema.extend({
  kind: z.literal('annexA'),
  applicabilityStatementRef: NonEmptyStringSchema,
});
export type AnnexAReport = z.infer<typeof AnnexAReportSchema>;

export const ReadinessReportSchema = ReportBaseSchema.extend({
  kind: z.literal('readiness'),
  readinessScore: z.number().min(0).max(1),
  capaSummary: NonEmptyStringSchema,
});
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;

export const ReportInputSchema = z.discriminatedUnion('kind', [
  AuditReportSchema,
  AnnexAReportSchema,
  ReadinessReportSchema,
]);
export type ReportInput = z.infer<typeof ReportInputSchema>;

/**
 * Mandatory non-certification disclaimer for Readiness Mode reports — exact wording per CLAUDE.md "Termination Semantics".
 */
export const READINESS_DISCLAIMER =
  'This Readiness Assessment is NOT a certification audit and does not constitute conformity. ' +
  'It is an informal pre-certification readiness check produced by a Lead Auditor exercising professional judgement. ' +
  'No certificate of conformity is issued or implied. The phrase "appears ready" reflects the auditor\'s view at the time of assessment only.';

export function readinessOverallScore(clauses: readonly ReportClause[]): number {
  let weightSum = 0;
  let scoreSum = 0;
  for (const c of clauses) {
    if (c.status === 'na') continue;
    weightSum += c.weight;
    if (c.status === 'evidenced') scoreSum += c.weight * 1.0;
    else if (c.status === 'partial') scoreSum += c.weight * 0.5;
  }
  if (weightSum === 0) return 0;
  return scoreSum / weightSum;
}
