// SPDX-License-Identifier: BUSL-1.1
/**
 * Outbound ports (hexagonal architecture) for capabilities this package
 * delegates to other packages. Each port is a minimal local definition
 * used while the corresponding package is still in flux; once the real
 * package ships, the port can be replaced with a direct import (or the
 * port can stay and remain the integration seam — both are fine).
 *
 * TODO(@auditforge/audit-engine): replace `LedgerPort` with the real
 *   ledger event API when audit-engine ships. The shape below is
 *   intentionally minimal.
 *
 * TODO(@auditforge/tenancy-core): replace `TenantContext` with the
 *   `TenantPrincipal` from tenancy-core; the shape below mirrors the
 *   `(firm_id, auditor_id, engagement_id)` triple from §4.2 of
 *   `auditforge.md`.
 */
import type {
  AuditorId,
  EngagementId,
  FirmId,
  LedgerEventId,
} from '@auditforge/shared';

/** Tenancy triple as described in `auditforge.md` §4.2. */
export interface TenantContext {
  readonly firmId: FirmId;
  readonly auditorId: AuditorId;
  readonly engagementId: EngagementId;
}

/** A single ledger event payload — minimal shape pending audit-engine. */
export interface LedgerEvent {
  readonly id: LedgerEventId;
  readonly tenant: TenantContext;
  readonly type: string;
  readonly at: string; // ISO 8601 instant
  readonly payload: Readonly<Record<string, unknown>>;
}

/** Outbound port that engagement services use to emit ledger events. */
export interface LedgerPort {
  emit(event: Omit<LedgerEvent, 'id' | 'at'>): Promise<LedgerEventId>;
}

/**
 * In-memory `LedgerPort` for tests and local dev. Stores events in a
 * mutable array; assigns deterministic-looking ids.
 */
export class InMemoryLedger implements LedgerPort {
  private readonly events: LedgerEvent[] = [];
  private counter = 0;

  async emit(
    event: Omit<LedgerEvent, 'id' | 'at'>,
  ): Promise<LedgerEventId> {
    this.counter += 1;
    const id =
      `00000000-0000-4000-8000-${this.counter.toString(16).padStart(12, '0')}` as LedgerEventId;
    this.events.push({
      ...event,
      id,
      at: new Date().toISOString(),
    });
    return id;
  }

  /** Test helper: return all emitted events in order. */
  list(): readonly LedgerEvent[] {
    return [...this.events];
  }

  /** Test helper: filter by type. */
  byType(type: string): readonly LedgerEvent[] {
    return this.events.filter((e) => e.type === type);
  }
}
