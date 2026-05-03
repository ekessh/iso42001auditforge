// SPDX-License-Identifier: BUSL-1.1
import { ImporterError } from '../compat/shared.js';
import type { AiSystemCreateInput } from '../types/ai-system.js';
import { emptyReport, type ValidationReport } from '../types/validation.js';
import { normalizeRow } from './normalize.js';
import type { AiSystemImporter, ImporterFormat } from './types.js';

export interface JsonImporterInput {
  /** Either a JSON-string or already-parsed JSON value. */
  payload: string | unknown;
  /** Optional dotted path into the payload that returns an array of records. */
  path?: string;
}

/**
 * JsonImporter — accepts either:
 *   1. an array of records `[{ ... }, ...]`
 *   2. an object `{ systems: [...] }` (path defaults to "systems" if a
 *      top-level key with that name exists)
 *   3. an object whose dotted-path resolves to a record array
 *
 * Used both as a first-class import format (auditees paste a JSON dump)
 * and as the underlying parser for the MLflow / W&B / HuggingFace
 * connector responses.
 */
export class JsonImporter implements AiSystemImporter<JsonImporterInput> {
  readonly format: ImporterFormat = 'json';

  async import(input: JsonImporterInput): Promise<{
    systems: readonly AiSystemCreateInput[];
    report: ValidationReport;
  }> {
    const report = emptyReport('json');
    let value: unknown;
    if (typeof input.payload === 'string') {
      try {
        value = JSON.parse(input.payload);
      } catch (e) {
        throw new ImporterError(`malformed JSON: ${(e as Error).message}`);
      }
    } else {
      value = input.payload;
    }
    const records = this.extractArray(value, input.path);
    if (!records) {
      throw new ImporterError('JSON payload did not resolve to an array of records');
    }
    const out: AiSystemCreateInput[] = [];
    records.forEach((row, idx) => {
      if (typeof row !== 'object' || row === null) {
        report.rejectedCount += 1;
        report.issues.push({
          level: 'error',
          code: 'JSON_NOT_OBJECT',
          message: `entry at index ${idx} is not an object`,
          path: [idx],
          row: idx,
        });
        return;
      }
      const { record, issues } = normalizeRow(row as Record<string, unknown>, idx);
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

  private extractArray(value: unknown, path?: string): unknown[] | undefined {
    if (Array.isArray(value)) return value;
    if (value === null || typeof value !== 'object') return undefined;
    const obj = value as Record<string, unknown>;
    if (path) {
      const node = path.split('.').reduce<unknown>((acc, key) => {
        if (acc !== null && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[key];
        }
        return undefined;
      }, obj);
      return Array.isArray(node) ? node : undefined;
    }
    if (Array.isArray(obj.systems)) return obj.systems;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
    return undefined;
  }
}
