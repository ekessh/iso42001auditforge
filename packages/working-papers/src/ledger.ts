// SPDX-License-Identifier: BUSL-1.1
import type { TenantContext } from '@auditforge/shared';
import type { Verdict, WorkingPaper } from './domain.js';

/**
 * Outbound ledger event types emitted by the working-paper registry. The audit
 * ledger lives in `@auditforge/audit-engine`; this package is decoupled by an
 * emitter callback, so the registry has no transitive dep on the ledger.
 */
export type WpLedgerEvent =
  | {
      type: 'wp.created';
      tenant: TenantContext;
      workingPaperId: string;
      templateId: string;
      authorId: string;
      at: string;
    }
  | {
      type: 'wp.updated';
      tenant: TenantContext;
      workingPaperId: string;
      revision: number;
      contentHash: string;
      authorId: string;
      at: string;
    }
  | {
      type: 'wp.verdict_changed';
      tenant: TenantContext;
      workingPaperId: string;
      from: Verdict;
      to: Verdict;
      reason: string | undefined;
      authorId: string;
      at: string;
    }
  | {
      type: 'wp.deleted';
      tenant: TenantContext;
      workingPaperId: string;
      authorId: string;
      at: string;
    }
  | {
      type: 'wp.evidence_linked';
      tenant: TenantContext;
      workingPaperId: string;
      linkId: string;
      kind: string;
      authorId: string;
      at: string;
    }
  | {
      type: 'wp.observation_added';
      tenant: TenantContext;
      workingPaperId: string;
      observationId: string;
      severity: string;
      authorId: string;
      at: string;
    };

export type WpLedgerEmitter = (event: WpLedgerEvent) => void | Promise<void>;

/** A no-op emitter — useful in tests where the ledger is not under test. */
export const noopWpLedger: WpLedgerEmitter = () => {
  /* no-op */
};

/** Helper: build a sane "now" ISO string. Centralized so tests can monkeypatch. */
export function nowIso(): string {
  return new Date().toISOString();
}

export type { WorkingPaper };
