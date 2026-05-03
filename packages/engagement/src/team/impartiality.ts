// SPDX-License-Identifier: BUSL-1.1
/**
 * Impartiality / conflict-of-interest checks per
 * ISO/IEC 17021-1:2015 clause 5.2 + Annex C.
 *
 * Default lookback: 2 years (configurable). The 2-year window matches the
 * common interpretation of clause 5.2.6 and Annex C.2.b ("management
 * system consultancy"). Some accreditation bodies require longer windows;
 * the lookback is a parameter for that reason.
 */
import type { AuditorId, ClientId } from '@auditforge/shared';

import type {
  AuditorRelationship,
  ImpartialityCheck,
  ImpartialityReason,
} from '../types/team.js';

export const DEFAULT_IMPARTIALITY_LOOKBACK_YEARS = 2;

interface EvaluateOptions {
  readonly lookbackYears?: number;
  /** Reference "now" for tests (ISO 8601 date). Defaults to `new Date()`. */
  readonly now?: string;
  /**
   * Minimum gap (years) before the same auditor can re-audit the same
   * client. Per ISO/IEC 17021-1 5.2.5 / Annex C.2 — typically 2 cycles
   * or "at least every 7 years" depending on scheme. Default 7.
   */
  readonly previousAuditMinGapYears?: number;
}

function diffYears(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return Number.POSITIVE_INFINITY;
  // 365.25 to handle leap years uniformly.
  return (to - from) / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Evaluate whether `auditorId` may audit `clientId`.
 *
 * Rules applied:
 *  1. Consultancy / advisory work for the client within the lookback
 *     window -> conflict.
 *  2. Employment with the client (overlapping or recently ended) -> conflict.
 *  3. Family or financial relationship -> always conflict.
 *  4. Previous audit of the same client more recent than
 *     `previousAuditMinGapYears` -> conflict (rotation rule).
 *
 * @see ISO/IEC 17021-1:2015 clause 5.2 + Annex C
 */
export function evaluateImpartiality(
  auditorId: AuditorId,
  clientId: ClientId,
  relationships: readonly AuditorRelationship[],
  options: EvaluateOptions = {},
): ImpartialityCheck {
  const lookbackYears = options.lookbackYears ?? DEFAULT_IMPARTIALITY_LOOKBACK_YEARS;
  const minGap = options.previousAuditMinGapYears ?? 7;
  const now = options.now ?? new Date().toISOString();

  const reasons: ImpartialityReason[] = [];

  for (const r of relationships) {
    if (r.auditorId !== auditorId || r.clientId !== clientId) continue;

    const yearsSinceStarted = diffYears(r.startedAt, now);
    const yearsSinceEnded =
      r.endedAt !== undefined ? diffYears(r.endedAt, now) : 0; // ongoing

    switch (r.kind) {
      case 'consulted_for_client':
        // Conflict if the more recent of (start, end) is within the window.
        if (Math.min(yearsSinceStarted, yearsSinceEnded) < lookbackYears) {
          reasons.push({
            kind: 'consulted_for_client',
            consultedAt: r.endedAt ?? r.startedAt,
            description: r.description,
          });
        }
        break;

      case 'employment_with_client':
        if (yearsSinceEnded < lookbackYears) {
          reasons.push({
            kind: 'employment_with_client',
            from: r.startedAt,
            ...(r.endedAt !== undefined ? { to: r.endedAt } : {}),
          });
        }
        break;

      case 'family_relationship':
      case 'financial_interest':
        reasons.push(
          r.kind === 'family_relationship'
            ? { kind: 'family_relationship', description: r.description }
            : { kind: 'financial_interest', description: r.description },
        );
        break;

      case 'previous_audit_too_recent':
        // For rotation we look at the START date of the previous audit.
        if (yearsSinceStarted < minGap) {
          reasons.push({
            kind: 'previous_audit_too_recent',
            previousAuditDate: r.startedAt,
          });
        }
        break;
    }
  }

  return {
    auditorId,
    clientId,
    verdict: reasons.length === 0 ? 'clear' : 'conflict',
    reasons: Object.freeze(reasons),
    lookbackYears,
  };
}
