// SPDX-License-Identifier: BUSL-1.1
import type { AimsScope } from './engagement.js';

/**
 * Inputs to the programme calculator. The fields mirror those required by
 * IAF MD 23:2023 (clauses §5–§7) plus the AIMS-specific factors derived
 * from the `AimsScope`.
 */
export interface ProgrammeInputs {
  readonly aimsScope: AimsScope;
  /**
   * Optional override of the auditee's effective personnel count (the
   * primary input to ISO/IEC 17021-1:2015 Annex A Table A.1). If absent,
   * the calculator uses a conservative default derived from the AIMS
   * scope (use cases × models × agents). This is a deliberately small
   * heuristic — production deployments must override with the real
   * effective personnel count.
   */
  readonly effectivePersonnelCount?: number;
  /**
   * Reduction percentage (0–100) the calculator should treat as the
   * default integration reduction per integrated MS, when not overridden
   * by the per-standard table. Defaults to 20.
   */
  readonly defaultIntegrationReductionPct?: number;
}

export type AuditTypeKey =
  | 'stage1'
  | 'stage2'
  | 'surveillance'
  | 'recert'
  | 'cycleTotal';

/**
 * Single line item in the structured rationale. Auditors reading the
 * calculator output should be able to follow each line and verify the
 * math against their licensed copy of ISO/IEC 17021-1 + IAF MD 23.
 */
export interface ProgrammeRationaleLine {
  readonly factor: string;
  readonly clauseRef: string; // e.g. "ISO/IEC 17021-1:2015 9.1.4" or "IAF MD 23:2023 §5.2"
  readonly delta: number; // +/- man-days contributed by this factor
  readonly note?: string;
}

export interface ProgrammeBreakdown {
  readonly minDays: number;
  readonly rationale: readonly ProgrammeRationaleLine[];
}

export interface ProgrammeOutputs {
  readonly stage1MinDays: number;
  readonly stage2MinDays: number;
  readonly surveillanceMinDays: number; // per surveillance visit
  readonly recertMinDays: number;
  readonly totalCycleMinDays: number; // S1 + S2 + 2×Surv + Recert
  /** Per-audit-type breakdown including rationale */
  readonly byAuditType: Readonly<Record<AuditTypeKey, ProgrammeBreakdown>>;
  /**
   * Integration reduction actually applied (percent). May be lower than
   * what was requested because IAF MD 11 caps at 30%.
   */
  readonly integrationReductionPctApplied: number;
  /** Convenience flag: warns the caller if virtual % exceeds IAF MD 4 cap */
  readonly virtualAuditWarning?: string;
}
