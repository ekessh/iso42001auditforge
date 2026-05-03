// SPDX-License-Identifier: BUSL-1.1
//
// Peer-review adapter — wires `@auditforge/peer-review` into the API.
//
// Provides:
//   - `PeerReviewWorkflow` (assign / record-response / request-changes /
//     resubmit / approve / withdraw + ledger emission).
//   - `ChecklistRegistry` (versioned checklists with binding integrity).
//   - `QualityScoring` (per-checklist quality scoring).
//   - `InvariantsChecker` (independence + separation-of-duties).
//   - Tenant-scoped registry over the API DTO surface.

import { Inject, Injectable } from '@nestjs/common';
import {
  PeerReviewWorkflow,
  ChecklistRegistry,
  QualityScoring,
  InvariantsChecker,
  type LedgerEmitter as PeerReviewLedger,
  type PeerReviewLedgerEvent,
} from '@auditforge/peer-review';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  PeerReviewDto,
  CreatePeerReviewDto,
  UpdatePeerReviewDto,
} from '../modules/peer-review/dto.js';

@Injectable()
export class PeerReviewAdapter {
  /** Workflow orchestrator — pure, ledger-emitting. */
  readonly workflow: PeerReviewWorkflow;

  /** Versioned checklist catalogue. */
  readonly checklistRegistry = new ChecklistRegistry();

  /** Pure helpers re-exported. */
  readonly scoring = QualityScoring;
  readonly invariants = InvariantsChecker;

  /** Tenant-scoped registry over the API DTO. */
  readonly registry: TenantScopedRegistry<PeerReviewDto, CreatePeerReviewDto, UpdatePeerReviewDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    const ledger: PeerReviewLedger = {
      emit: (event: PeerReviewLedgerEvent) => {
        // Fire-and-forget; the audit-engine adapter logs internally on error.
        const e = event as { kind: string; requestId?: string; firmId?: string; engagementId?: string; actorId?: string };
        void audit.append({
          firmId: typeof e.firmId === 'string' ? e.firmId : 'unknown',
          actorId: typeof e.actorId === 'string' ? e.actorId : 'system',
          ...(typeof e.engagementId === 'string' ? { engagementId: e.engagementId } : {}),
          type: e.kind,
          entity: 'peer-review',
          entityId: typeof e.requestId === 'string' ? e.requestId : 'unknown',
          payload: event as unknown as Record<string, unknown>,
        });
      },
    };
    this.workflow = new PeerReviewWorkflow(ledger);

    this.registry = new TenantScopedRegistry<PeerReviewDto, CreatePeerReviewDto, UpdatePeerReviewDto>(
      { entity: 'peer-review', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as PeerReviewDto,
      'PeerReview',
    );
  }
}
