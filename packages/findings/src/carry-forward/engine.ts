// SPDX-License-Identifier: BUSL-1.1
/**
 * SurveillanceCarryForwardEngine — given the previous audit event's findings
 * and the upcoming surveillance event, returns the set of open NCs that
 * MUST appear on the new surveillance plan and emits ledger events for
 * each carry.
 *
 * Per ISO/IEC 17021-1 9.6.2, surveillance audits must verify continuing
 * conformity, including the effectiveness of CAPA on prior NCs. We
 * carry forward any finding that is still open (`draft`, `issued`,
 * `accepted`, `disputed`). OFIs and Conformity statements do NOT carry
 * forward (they're informational, not requirements-driven).
 */
import type {
  AuditEventId,
  AuditorId,
  EngagementId,
} from '@auditforge/shared';
import type { Finding, FindingId } from '../types/finding.js';
import { isOpenFinding } from '../types/finding.js';
import type {
  FindingRegistry,
  TenantContext,
} from '../registry/registry.js';

export interface CarryForwardInput {
  readonly engagementId: EngagementId;
  readonly fromAuditEventId: AuditEventId;
  readonly toAuditEventId: AuditEventId;
  readonly carriedAt: string;
  readonly by: AuditorId;
}

export interface CarryForwardEntry {
  readonly findingId: FindingId;
  readonly number: string;
  readonly type: Finding['type'];
}

export interface CarryForwardResult {
  /** All findings that were eligible for carry-forward (open NCs only). */
  readonly carried: readonly CarryForwardEntry[];
  /** Findings that were inspected but skipped (closed / OFI / conformity). */
  readonly skipped: readonly { readonly findingId: FindingId; readonly reason: SkipReason }[];
}

export type SkipReason =
  | 'not_open'
  | 'not_a_non_conformity'
  | 'wrong_audit_event';

export interface SurveillanceCarryForwardEngine {
  carryForward(
    input: CarryForwardInput,
    tenant: TenantContext,
  ): CarryForwardResult;
}

export function createSurveillanceCarryForwardEngine(
  registry: FindingRegistry,
): SurveillanceCarryForwardEngine {
  return {
    carryForward(input, tenant) {
      const candidates = registry.listByAuditEvent(
        input.fromAuditEventId,
        tenant,
      );
      const carried: CarryForwardEntry[] = [];
      const skipped: { findingId: FindingId; reason: SkipReason }[] = [];

      for (const f of candidates) {
        if (f.engagementId !== input.engagementId) {
          skipped.push({ findingId: f.id, reason: 'wrong_audit_event' });
          continue;
        }
        if (f.type === 'ofi' || f.type === 'conformity') {
          skipped.push({ findingId: f.id, reason: 'not_a_non_conformity' });
          continue;
        }
        if (!isOpenFinding(f)) {
          skipped.push({ findingId: f.id, reason: 'not_open' });
          continue;
        }
        registry.recordCarryForward(
          f.id,
          {
            newAuditEventId: input.toAuditEventId,
            carriedAt: input.carriedAt,
            by: input.by,
          },
          tenant,
        );
        carried.push({ findingId: f.id, number: f.number, type: f.type });
      }

      return { carried, skipped };
    },
  };
}
