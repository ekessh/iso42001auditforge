// SPDX-License-Identifier: BUSL-1.1
/**
 * Ledger event types emitted by the findings package. The audit ledger
 * is owned by `@auditforge/audit-engine`; this package consumes a thin
 * `LedgerEmitter` interface so it doesn't need the engine present at
 * construction time (and so tests can use an in-memory stub).
 */
import type {
  AuditEventId,
  AuditorId,
  ClientId,
  EngagementId,
  FindingId,
  FirmId,
} from '@auditforge/shared';
import type {
  DispositionHistoryEntry,
  FindingStatus,
  FindingType,
} from './finding.js';

export type FindingLedgerEventKind =
  | 'finding.created'
  | 'finding.transitioned'
  | 'finding.carried_forward';

export interface FindingLedgerEnvelope {
  readonly kind: FindingLedgerEventKind;
  readonly findingId: FindingId;
  readonly firmId: FirmId;
  readonly clientId: ClientId;
  readonly engagementId: EngagementId;
  readonly auditEventId: AuditEventId;
  readonly at: string; // ISO 8601
  readonly by: AuditorId;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface FindingCreatedPayload {
  readonly type: FindingType;
  readonly number: string;
  readonly clauseLinkCount: number;
  readonly controlLinkCount: number;
  readonly evidenceLinkCount: number;
}

export interface FindingTransitionedPayload {
  readonly entry: DispositionHistoryEntry;
  readonly fromStatus: FindingStatus;
  readonly toStatus: FindingStatus;
}

export interface FindingCarriedForwardPayload {
  readonly fromAuditEventId: AuditEventId;
  readonly toAuditEventId: AuditEventId;
}

/**
 * Minimal interface this package needs from the audit ledger. Implementors:
 *
 * - production: `@auditforge/audit-engine` PostgresLedger
 * - tests:      `inMemoryLedger()` factory in `src/ledger`
 *
 * `emit` MUST be deterministic-or-idempotent w.r.t. the same envelope so
 * retries on persistent stores don't double-write.
 */
export interface LedgerEmitter {
  emit(envelope: FindingLedgerEnvelope): void;
}
