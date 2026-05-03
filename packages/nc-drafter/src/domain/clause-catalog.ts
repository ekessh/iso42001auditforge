// SPDX-License-Identifier: BUSL-1.1
/**
 * Minimal clause catalog metadata consumed by the detectors.
 *
 * Real catalog lives in `@auditforge/catalogues`; the detectors only need to
 * know whether a clause is a mandatory main-body clause (4–10) and which Annex
 * A family it belongs to, so we keep a tiny in-package shape.
 */
import { z } from 'zod';
import { ClauseIdSchema } from './candidate-finding.js';

export const ClauseFamilySchema = z.enum([
  'main_body', // ISO 42001 clauses 4..10
  'annex_a_2',
  'annex_a_3',
  'annex_a_4',
  'annex_a_5',
  'annex_a_6',
  'annex_a_7',
  'annex_a_8',
  'annex_a_9',
  'annex_a_10',
]);
export type ClauseFamily = z.infer<typeof ClauseFamilySchema>;

/** "high" — drives Major NC by default for a direct conformity gap on a
 *  mandatory clause; "medium" — Minor NC; "low" — OFI candidate only. */
export const ClauseSeveritySchema = z.enum(['high', 'medium', 'low']);
export type ClauseSeverity = z.infer<typeof ClauseSeveritySchema>;

export const ClauseMetaSchema = z.object({
  clauseId: ClauseIdSchema,
  family: ClauseFamilySchema,
  /** Mandatory main-body clauses are heavier per the readiness weighting. */
  mandatory: z.boolean(),
  severity: ClauseSeveritySchema,
  title: z.string().min(1).max(200),
});
export type ClauseMeta = z.infer<typeof ClauseMetaSchema>;

export interface ClauseCatalog {
  get(clauseId: string): ClauseMeta | undefined;
  isValid(clauseId: string): boolean;
}

/** In-memory catalog used by tests and lightweight runtime contexts. */
export class InMemoryClauseCatalog implements ClauseCatalog {
  private readonly entries: ReadonlyMap<string, ClauseMeta>;

  constructor(entries: readonly ClauseMeta[]) {
    const m = new Map<string, ClauseMeta>();
    for (const e of entries) m.set(e.clauseId, e);
    this.entries = m;
  }

  get(clauseId: string): ClauseMeta | undefined {
    return this.entries.get(clauseId);
  }

  isValid(clauseId: string): boolean {
    return this.entries.has(clauseId);
  }
}
