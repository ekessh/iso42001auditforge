// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/**
 * Importer/validator report — every importer + the data-flow mapper return
 * one of these so the UI can render a unified results panel without
 * importer-specific knowledge.
 */
export const ValidationIssueSchema = z.object({
  level: z.enum(['error', 'warning', 'info']),
  code: z.string().min(1),
  message: z.string().min(1).max(4000),
  path: z.array(z.union([z.string(), z.number()])).default([]),
  /** Optional row index for tabular sources (XLSX, CSV). */
  row: z.number().int().nonnegative().optional(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationReportSchema = z.object({
  source: z.string().min(1),
  acceptedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative(),
  issues: z.array(ValidationIssueSchema),
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

export function emptyReport(source: string): ValidationReport {
  return { source, acceptedCount: 0, rejectedCount: 0, issues: [] };
}
