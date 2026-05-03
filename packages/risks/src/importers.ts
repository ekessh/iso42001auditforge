// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { AiRiskRegisterEntry } from './domain.js';

export interface ImportReport {
  imported: number;
  errors: Array<{ row: number; message: string }>;
}

const RowSchema = AiRiskRegisterEntry.partial();

export function importJson(payload: unknown): { entries: ReturnType<typeof AiRiskRegisterEntry.parse>[]; report: ImportReport } {
  const arr = z.array(z.unknown()).parse(payload);
  const entries: ReturnType<typeof AiRiskRegisterEntry.parse>[] = [];
  const errors: ImportReport['errors'] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = AiRiskRegisterEntry.safeParse(arr[i]);
    if (r.success) entries.push(r.data);
    else errors.push({ row: i + 1, message: r.error.message });
  }
  return { entries, report: { imported: entries.length, errors } };
}

export function importCsvRows(rows: Record<string, string>[]): { entries: ReturnType<typeof AiRiskRegisterEntry.parse>[]; report: ImportReport } {
  const entries: ReturnType<typeof AiRiskRegisterEntry.parse>[] = [];
  const errors: ImportReport['errors'] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const candidate = {
      id: row.id,
      firmId: row.firmId,
      engagementId: row.engagementId,
      ownerOrg: row.ownerOrg,
      riskTitle: row.riskTitle,
      description: row.description,
      category: row.category,
      likelihood: Number(row.likelihood),
      impact: Number(row.impact),
      inherentScore: Number(row.inherentScore),
      controls: row.controls?.split('|') ?? [],
      residualScore: row.residualScore ? Number(row.residualScore) : undefined,
      treatmentPlan: row.treatmentPlan,
    };
    const r = AiRiskRegisterEntry.safeParse(candidate);
    if (r.success) entries.push(r.data);
    else errors.push({ row: i + 1, message: r.error.message });
  }
  return { entries, report: { imported: entries.length, errors } };
}

export const _RowSchema = RowSchema;
