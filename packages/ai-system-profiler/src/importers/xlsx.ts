// SPDX-License-Identifier: BUSL-1.1
import * as XLSX from 'xlsx';
import type { AiSystemCreateInput } from '../types/ai-system.js';
import {
  emptyReport,
  type ValidationIssue,
  type ValidationReport,
} from '../types/validation.js';
import { ImporterError } from '../compat/shared.js';
import { normalizeRow } from './normalize.js';
import type { AiSystemImporter, ImporterFormat } from './types.js';

export interface XlsxImporterInput {
  /** Buffer of an .xlsx file. */
  buffer: ArrayBuffer | Uint8Array | Buffer;
  /** Sheet name to read; defaults to the first sheet. */
  sheet?: string;
}

/**
 * XlsxImporter — parses an auditee-supplied AI inventory spreadsheet into
 * `AiSystemCreateInput[]`. Uses sheetjs (xlsx). Each row is treated as
 * one AI system; columns map to top-level + per-kind intake fields.
 *
 * Failure semantics: parser errors → throw `ImporterError`; per-row
 * validation errors → reported in {@link ValidationReport.issues} but do
 * not stop processing — partial successful imports are common in audits.
 */
export class XlsxImporter implements AiSystemImporter<XlsxImporterInput> {
  readonly format: ImporterFormat = 'xlsx';

  async import(input: XlsxImporterInput): Promise<{
    systems: readonly AiSystemCreateInput[];
    report: ValidationReport;
  }> {
    const report = emptyReport('xlsx');
    let workbook: XLSX.WorkBook;
    try {
      const data = input.buffer instanceof Uint8Array ? input.buffer : new Uint8Array(input.buffer as ArrayBuffer);
      workbook = XLSX.read(data, { type: 'array' });
    } catch (e) {
      throw new ImporterError(`malformed XLSX: ${(e as Error).message}`, { cause: String(e) });
    }
    const sheetName = input.sheet ?? workbook.SheetNames[0];
    if (sheetName === undefined) {
      throw new ImporterError('XLSX has no sheets');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new ImporterError(`XLSX sheet not found: ${sheetName}`);
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: undefined,
      raw: true,
    });
    const out: AiSystemCreateInput[] = [];
    rows.forEach((row, idx) => {
      const issues: ValidationIssue[] = [];
      const { record, issues: rowIssues } = normalizeRow(row, idx + 1);
      issues.push(...rowIssues);
      report.issues.push(...issues);
      if (record) {
        out.push(record);
        report.acceptedCount += 1;
      } else {
        report.rejectedCount += 1;
      }
    });
    return { systems: out, report };
  }
}
