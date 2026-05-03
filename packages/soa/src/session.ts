// SPDX-License-Identifier: BUSL-1.1
import type { ImportResult } from './importers.js';
import { type SoaImportFormat, type SoaImportSession } from './domain.js';
import { assertSafeRelativePath } from './path-safety.js';

export interface CreateImportSessionInput {
  id: string;
  firmId: string;
  engagementId: string;
  importedBy: string;
  sourceFile: string;
  format: SoaImportFormat;
  startedAt: string;
  finishedAt: string;
  result: ImportResult;
}

/**
 * Wrap an `ImportResult` into a persistable `SoaImportSession`. Validates
 * the source file path again (defence in depth) and aggregates counts.
 */
export function createImportSession(input: CreateImportSessionInput): SoaImportSession {
  assertSafeRelativePath(input.sourceFile);
  return {
    id: input.id,
    firmId: input.firmId,
    engagementId: input.engagementId,
    importedBy: input.importedBy,
    sourceFile: input.sourceFile,
    format: input.format,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    parsed: input.result.report.totalRows,
    accepted: input.result.report.acceptedRows,
    rejected: input.result.report.rejectedRows,
    report: input.result.report,
  };
}
