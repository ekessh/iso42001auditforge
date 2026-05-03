// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-1): switch to @auditforge/audit-engine once available; this
// shim defines the LedgerEvent emitter contract used by the profiler so
// CRUD on AI systems is recorded on the hash-chained signed audit ledger.

import type { TenantContext } from './shared.js';

/**
 * Logical action recorded on the AuditForge ledger.
 * Phase-2 actions cover the AI System Profiler module per design § 3.3.
 */
export type LedgerAction =
  | 'AI_SYSTEM_CREATED'
  | 'AI_SYSTEM_UPDATED'
  | 'AI_SYSTEM_DELETED'
  | 'AI_SYSTEM_VERSION_SNAPSHOTTED'
  | 'AI_SYSTEM_IMPORTED'
  | 'AI_SYSTEM_PROFILED'
  | 'AI_SYSTEM_RISK_CLASSIFIED'
  | 'AI_SYSTEM_DATAFLOW_VALIDATED'
  | 'AI_SYSTEM_STAKEHOLDER_MAPPED';

export interface LedgerEvent {
  readonly action: LedgerAction;
  readonly resourceType: 'ai_system' | 'ai_system_version' | 'data_flow' | 'stakeholder_map';
  readonly resourceId: string;
  readonly tenant: TenantContext;
  readonly actor?: string;
  readonly timestamp: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

/**
 * Pluggable emitter — tests use a `MemoryLedgerEmitter`; production wiring
 * (Phase 1) substitutes the signed/hash-chained ledger from
 * @auditforge/audit-engine.
 */
export interface LedgerEmitter {
  emit(event: LedgerEvent): Promise<void> | void;
}

/** In-memory ledger for unit tests + dry-run. */
export class MemoryLedgerEmitter implements LedgerEmitter {
  public readonly events: LedgerEvent[] = [];
  emit(event: LedgerEvent): void {
    this.events.push(event);
  }
  clear(): void {
    this.events.length = 0;
  }
}

/** No-op emitter for callers that haven't wired the audit-engine yet. */
export class NoopLedgerEmitter implements LedgerEmitter {
  emit(_event: LedgerEvent): void {
    // intentionally empty
  }
}
