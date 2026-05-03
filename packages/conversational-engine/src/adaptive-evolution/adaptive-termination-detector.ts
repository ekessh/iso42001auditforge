// SPDX-License-Identifier: BUSL-1.1
/**
 * Termination detector — v3 §15.12 / Phase 7.7.
 *
 * The engine NEVER auto-terminates; this module surfaces termination signals
 * for the auditor to act on.
 *
 *   - Per-area: all in-scope clauses for the area are evidenced or N/A → emit
 *     `areaCovered`.
 *   - Per-engagement Audit Mode: all in-scope clauses evidenced/N/A AND all
 *     candidate findings reviewed (decided) → emit `auditTerminationReady`.
 *   - Per-engagement Readiness Mode: all in-scope clauses evidenced AND all
 *     candidate NCs CLOSED (CAPA implemented + verified) → emit
 *     `readinessTerminationReady`.
 */
import { z } from 'zod';
import type { CoverageStatus, EngagementMode } from './adaptive-types.js';

export const AreaIdSchema = z.string().min(1).max(64);
export type AreaId = z.infer<typeof AreaIdSchema>;

export const TerminationSignalKindSchema = z.enum([
  'areaCovered',
  'auditTerminationReady',
  'readinessTerminationReady',
]);
export type TerminationSignalKind = z.infer<typeof TerminationSignalKindSchema>;

export interface TerminationSignal {
  readonly kind: TerminationSignalKind;
  readonly engagementId: string;
  readonly areaId?: string;
  readonly at: string;
  readonly rationale: string;
}

export interface AreaScopeRow {
  readonly areaId: string;
  readonly clauseId: string;
  readonly status: CoverageStatus;
  readonly inScope: boolean;
}

export interface CandidateFindingDecisionStatus {
  readonly id: string;
  readonly decided: boolean;
}

export interface CandidateFindingClosureStatus {
  readonly id: string;
  /** True only when the corrective action has been implemented AND verified. */
  readonly closed: boolean;
}

export interface AuditTerminationInput {
  readonly engagementId: string;
  readonly mode: 'audit';
  readonly clauseRows: readonly AreaScopeRow[];
  readonly candidateFindings: readonly CandidateFindingDecisionStatus[];
  readonly now: string;
}

export interface ReadinessTerminationInput {
  readonly engagementId: string;
  readonly mode: 'readiness';
  readonly clauseRows: readonly AreaScopeRow[];
  readonly candidateFindings: readonly CandidateFindingClosureStatus[];
  readonly now: string;
}

export type EngagementTerminationInput =
  | AuditTerminationInput
  | ReadinessTerminationInput;

/**
 * Pure termination detector. Returns the *set* of termination signals
 * applicable right now; the orchestrator surfaces them in the UI.
 */
export class TerminationDetector {
  /** Per-area: all in-scope clauses evidenced or na. */
  detectAreaCovered(
    engagementId: string,
    rows: readonly AreaScopeRow[],
    now: string,
  ): readonly TerminationSignal[] {
    const byArea = new Map<string, AreaScopeRow[]>();
    for (const r of rows) {
      if (!r.inScope) continue;
      let bucket = byArea.get(r.areaId);
      if (!bucket) {
        bucket = [];
        byArea.set(r.areaId, bucket);
      }
      bucket.push(r);
    }
    const signals: TerminationSignal[] = [];
    for (const [areaId, bucket] of byArea) {
      if (bucket.length === 0) continue;
      const allOk = bucket.every(
        (r) => r.status === 'evidenced' || r.status === 'na',
      );
      if (allOk) {
        signals.push({
          kind: 'areaCovered',
          engagementId,
          areaId,
          at: now,
          rationale: `All ${bucket.length} in-scope clauses for area ${areaId} are evidenced or N/A.`,
        });
      }
    }
    return signals;
  }

  /** Per-engagement detection by mode. */
  detectEngagement(
    input: EngagementTerminationInput,
  ): readonly TerminationSignal[] {
    const inScopeOk = input.clauseRows
      .filter((r) => r.inScope)
      .every((r) => r.status === 'evidenced' || r.status === 'na');
    if (!inScopeOk) return [];

    if (input.mode === 'audit') {
      const allReviewed = input.candidateFindings.every((c) => c.decided);
      if (!allReviewed) return [];
      return [
        {
          kind: 'auditTerminationReady',
          engagementId: input.engagementId,
          at: input.now,
          rationale: `All in-scope clauses evidenced or N/A; ${input.candidateFindings.length} candidate findings reviewed.`,
        },
      ];
    }

    if (input.mode === 'readiness') {
      const onlyEvidenced = input.clauseRows
        .filter((r) => r.inScope)
        .every((r) => r.status === 'evidenced');
      if (!onlyEvidenced) return [];
      const allClosed = input.candidateFindings.every((c) => c.closed);
      if (!allClosed) return [];
      return [
        {
          kind: 'readinessTerminationReady',
          engagementId: input.engagementId,
          at: input.now,
          rationale: `All in-scope clauses evidenced; ${input.candidateFindings.length} candidate findings closed.`,
        },
      ];
    }

    const _exhaustive: never = input;
    return _exhaustive;
  }
}

export type { EngagementMode };
