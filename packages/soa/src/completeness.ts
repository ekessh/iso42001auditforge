// SPDX-License-Identifier: BUSL-1.1
import type { AnnexAControlRef } from '@auditforge/catalogues';
import type { SoaRecord } from './domain.js';

export interface CompletenessReport {
  totalControls: number;
  presentControls: number;
  missingControls: AnnexAControlRef[];
  /** Annex A controls that exist in the SoA but are marked not_applicable. */
  excludedControls: { control: AnnexAControlRef; justification: string | undefined }[];
  /** Per-category breakdown for the auditor UI. */
  byCategory: Record<
    string,
    { total: number; present: number; missing: number; excluded: number }
  >;
  /** True iff every Annex A control id appears in the SoA at least once. */
  isComplete: boolean;
  /** Records whose controlId did not match any catalogue entry. */
  unknownControls: string[];
}

/**
 * Compare an SoA against the loaded Annex A control catalogue. Returns
 * a structured report - no I/O, callers feed in the controls list. This
 * deliberately leaves catalogue selection (e.g. ISO 42001:2023 vs a
 * future revision) to the caller.
 */
export function checkCompleteness(
  records: SoaRecord[],
  controls: AnnexAControlRef[],
): CompletenessReport {
  const byId = new Map(controls.map((c) => [c.id, c]));
  const present = new Set<string>();
  const excludedById = new Map<string, string | undefined>();
  const unknown: string[] = [];

  for (const r of records) {
    if (!byId.has(r.controlId)) {
      unknown.push(r.controlId);
      continue;
    }
    present.add(r.controlId);
    if (r.applicability === 'not_applicable') {
      excludedById.set(r.controlId, r.justification);
    }
  }

  const missing: AnnexAControlRef[] = [];
  const excluded: { control: AnnexAControlRef; justification: string | undefined }[] = [];
  const byCategory: CompletenessReport['byCategory'] = {};

  for (const c of controls) {
    byCategory[c.category] ??= { total: 0, present: 0, missing: 0, excluded: 0 };
    const cat = byCategory[c.category];
    if (cat === undefined) continue;
    cat.total += 1;
    if (present.has(c.id)) {
      cat.present += 1;
      if (excludedById.has(c.id)) {
        cat.excluded += 1;
        excluded.push({ control: c, justification: excludedById.get(c.id) });
      }
    } else {
      cat.missing += 1;
      missing.push(c);
    }
  }

  return {
    totalControls: controls.length,
    presentControls: present.size,
    missingControls: missing,
    excludedControls: excluded,
    byCategory,
    isComplete: missing.length === 0,
    unknownControls: unknown,
  };
}

export interface JustificationQualityReport {
  control: AnnexAControlRef;
  controlId: string;
  justification: string | undefined;
  reasons: ('missing' | 'too_short' | 'placeholder')[];
}

const PLACEHOLDER_PHRASES = [
  'tbd',
  'to be determined',
  'see policy',
  'n/a',
  'not applicable',
  'not appicable', // common typo
  'pending',
];

/**
 * Flag exclusion justifications that look weak. Heuristic only - intended
 * to surface review candidates, not to auto-fail. Auditors decide.
 */
export function flagWeakJustifications(
  records: SoaRecord[],
  controls: AnnexAControlRef[],
  minLength = 30,
): JustificationQualityReport[] {
  const byId = new Map(controls.map((c) => [c.id, c]));
  const reports: JustificationQualityReport[] = [];
  for (const r of records) {
    if (r.applicability !== 'not_applicable') continue;
    const control = byId.get(r.controlId);
    if (control === undefined) continue;
    const j = (r.justification ?? '').trim();
    const reasons: ('missing' | 'too_short' | 'placeholder')[] = [];
    if (j === '') reasons.push('missing');
    else {
      if (j.length < minLength) reasons.push('too_short');
      const lower = j.toLowerCase();
      if (PLACEHOLDER_PHRASES.some((p) => lower === p || lower.startsWith(`${p} `))) {
        reasons.push('placeholder');
      }
    }
    if (reasons.length > 0) {
      reports.push({
        control,
        controlId: control.id,
        justification: r.justification,
        reasons,
      });
    }
  }
  return reports;
}
