// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import {
  IsoDateSchema,
  NonEmptyStringSchema,
  UuidSchema,
} from '@auditforge/shared';

/**
 * Auditee's declared applicability decision for one Annex A control.
 * "applicable" means the auditee includes it in scope; "not_applicable"
 * means the auditee excludes it (and therefore must justify exclusion).
 */
export const SoaApplicabilitySchema = z.enum(['applicable', 'not_applicable']);
export type SoaApplicability = z.infer<typeof SoaApplicabilitySchema>;

/**
 * Implementation status the auditee asserts for an applicable control.
 */
export const SoaImplementationStatusSchema = z.enum([
  'implemented',
  'partially_implemented',
  'planned',
  'not_implemented',
]);
export type SoaImplementationStatus = z.infer<
  typeof SoaImplementationStatusSchema
>;

/**
 * Per-control row from an auditee-supplied SoA document. Every field is
 * normalised - vendor spreadsheets vary wildly, so importers map to this
 * canonical shape.
 */
export const SoaRecordSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  /** Annex A control id, e.g. "A.5.4". Validated against catalogue at review-time. */
  controlId: NonEmptyStringSchema,
  applicability: SoaApplicabilitySchema,
  implementationStatus: SoaImplementationStatusSchema.optional(),
  /** Auditee's justification text. Required when applicability = not_applicable. */
  justification: z.string().max(20_000).optional(),
  /** Reference to the auditee's own internal control / documentation. */
  internalReference: z.string().max(2_000).optional(),
  /** Optional free-form notes (auditee or import source). */
  notes: z.string().max(10_000).optional(),
  /** Source row index inside the original import session (for traceability). */
  sourceRow: z.number().int().nonnegative().optional(),
  importedAt: IsoDateSchema,
});
export type SoaRecord = z.infer<typeof SoaRecordSchema>;

/**
 * Auditor verdict states for a single SoA record.
 */
export const SoaReviewVerdictSchema = z.enum([
  'pending',
  'confirmed',
  'disputed',
  'nc_raised',
  'na',
]);
export type SoaReviewVerdict = z.infer<typeof SoaReviewVerdictSchema>;

/**
 * Verdict transition action label - inputs to the state machine.
 */
export const SoaReviewActionSchema = z.enum([
  'confirm',
  'dispute',
  'raise_nc',
  'na',
  'withdraw',
]);
export type SoaReviewAction = z.infer<typeof SoaReviewActionSchema>;

export const SoaReviewSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  soaRecordId: UuidSchema,
  controlId: NonEmptyStringSchema,
  verdict: SoaReviewVerdictSchema,
  /** Auditor reason / observation text. Required for dispute / nc_raised. */
  rationale: z.string().max(20_000).optional(),
  /** When raise_nc, this links to the eventual finding. */
  findingId: UuidSchema.optional(),
  reviewerId: UuidSchema,
  reviewedAt: IsoDateSchema,
  /** Auditor confidence, 0-100. */
  confidence: z.number().int().min(0).max(100).default(80),
});
export type SoaReview = z.infer<typeof SoaReviewSchema>;

/**
 * Source media for an import. Importers refuse anything outside this set
 * so the call site is forced to canonicalise upstream.
 */
export const SoaImportFormatSchema = z.enum(['xlsx', 'csv', 'json', 'pdf']);
export type SoaImportFormat = z.infer<typeof SoaImportFormatSchema>;

/**
 * Per-row import error - shape is stable so UI can render diagnostics.
 */
export const ValidationIssueSchema = z.object({
  /** Source row index (0-based excluding any header row). */
  row: z.number().int().nonnegative(),
  /** Source column / field name where the issue occurred. */
  field: z.string().max(200).optional(),
  /** Coarse classification used for filtering / counting. */
  code: z.enum([
    'missing_field',
    'invalid_value',
    'unknown_control',
    'duplicate_control',
    'malformed_row',
    'unsupported_format',
    'path_rejected',
  ]),
  message: z.string().min(1).max(2_000),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z.object({
  format: SoaImportFormatSchema,
  totalRows: z.number().int().nonnegative(),
  acceptedRows: z.number().int().nonnegative(),
  rejectedRows: z.number().int().nonnegative(),
  issues: z.array(ValidationIssueSchema),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

/**
 * The persistent record of one import attempt - stored regardless of
 * outcome so the auditor can audit the audit.
 */
export const SoaImportSessionSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  /** Sanitised, relative file name. Absolute paths and "../" segments are rejected. */
  sourceFile: z.string().min(1).max(1_024),
  format: SoaImportFormatSchema,
  startedAt: IsoDateSchema,
  finishedAt: IsoDateSchema,
  importedBy: UuidSchema,
  parsed: z.number().int().nonnegative(),
  accepted: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
  report: ValidationReportSchema,
});
export type SoaImportSession = z.infer<typeof SoaImportSessionSchema>;
