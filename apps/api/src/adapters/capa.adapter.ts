// SPDX-License-Identifier: BUSL-1.1
//
// CAPA adapter — wires `@auditforge/capa` into the API.
//
// Provides:
//   - `CapaWorkflow` (propose / accept / reject / implement / verify / close)
//   - `next` (state machine), `isTerminal`, `allowedActionsForRole`
//   - `evaluateSla` (CAPA SLA tracker — on_track / at_risk / overdue)
//   - Tenant-scoped registry over the API DTO surface (preserves controller).
//
// The richer CAPA workflow operates on `CorrectiveAction` aggregates with
// fields that are not yet exposed on the existing `CapaDto`. We instantiate
// the workflow eagerly (so callers that *do* speak the package vocabulary —
// e.g. findings -> capa promotion — have it available) but route the
// existing CRUD surface through the tenant registry for now.
//
// TODO(integration): once the API CRUD surface is enriched to carry
// `findingId`, `plannedActions`, `targetCloseDate`, the registry hook will
// invoke `CapaWorkflow.propose` automatically.

import { Inject, Injectable } from '@nestjs/common';
import {
  CapaWorkflow,
  evaluateSla,
  next as caStateNext,
  allowedActionsForRole,
  isTerminal,
  type CapaLedger,
  type CapaRepo,
  type CorrectiveAction,
  type CaImplementation,
  type CaVerification,
  type ReopenFinding,
  type SlaStatus,
} from '@auditforge/capa';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { CapaDto, CreateCapaDto, UpdateCapaDto } from '../modules/capa/dto.js';

/** In-memory `CapaRepo` — bridges the package interface to a Map. */
class InMemoryCapaRepo implements CapaRepo {
  private readonly cas = new Map<string, CorrectiveAction>();
  private readonly impls = new Map<string, CaImplementation>();
  private readonly verifs = new Map<string, CaVerification>();

  async saveCa(ca: CorrectiveAction): Promise<void> {
    this.cas.set(ca.id, ca);
  }
  async loadCa(id: string): Promise<CorrectiveAction | null> {
    return this.cas.get(id) ?? null;
  }
  async saveImpl(impl: CaImplementation): Promise<void> {
    this.impls.set(impl.id, impl);
  }
  async saveVerif(v: CaVerification): Promise<void> {
    this.verifs.set(v.id, v);
  }

  /** Test helper. */
  list(): readonly CorrectiveAction[] {
    return Array.from(this.cas.values());
  }
}

/**
 * No-op `ReopenFinding` — wires through the audit-engine adapter so a
 * verification.ineffective event still flows into the chain. The findings
 * adapter can subscribe to `capa.verification_ineffective` to perform the
 * actual finding reopen.
 *
 * TODO(integration): wire to `FindingsAdapter.registry.reopen` once the
 * findings registry exposes a public reopen API on the workflow façade.
 */
class LedgerOnlyReopenFinding implements ReopenFinding {
  constructor(private readonly audit: AuditEngineAdapter) {}
  async reopen(findingId: string): Promise<void> {
    await this.audit.append({
      firmId: 'unknown',
      actorId: 'system',
      type: 'finding.reopen_requested',
      entity: 'finding',
      entityId: findingId,
      payload: { producer: 'capa.verification_ineffective' },
    });
  }
}

@Injectable()
export class CapaAdapter {
  /** Package workflow — exposed for callers that speak the package vocabulary. */
  readonly workflow: CapaWorkflow;

  /** Underlying CAPA repo (test-only access; production swaps for Drizzle). */
  readonly capaRepo: InMemoryCapaRepo;

  /** Tenant-scoped registry over the API DTO surface. */
  readonly registry: TenantScopedRegistry<CapaDto, CreateCapaDto, UpdateCapaDto>;

  /** Re-export pure helpers so the API service layer can call them directly. */
  readonly stateMachine = {
    next: caStateNext,
    allowedActionsForRole,
    isTerminal,
  };

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.capaRepo = new InMemoryCapaRepo();
    const ledger: CapaLedger = {
      emit: async (eventType: string, payload: unknown) => {
        const p = (payload ?? {}) as Record<string, unknown>;
        const evt = await audit.append({
          firmId: 'unknown',
          actorId: 'system',
          type: eventType,
          entity: 'capa',
          entityId: typeof p['caId'] === 'string' ? (p['caId'] as string) : 'unknown',
          payload: p,
        });
        return { eventId: evt.id };
      },
    };
    this.workflow = new CapaWorkflow(this.capaRepo, ledger, new LedgerOnlyReopenFinding(audit));

    this.registry = new TenantScopedRegistry<CapaDto, CreateCapaDto, UpdateCapaDto>(
      { entity: 'capa', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as CapaDto,
      'Capa',
    );
  }

  /** Evaluate SLA for a corrective-action by id. Convenience for the API service. */
  async sla(caId: string, now = new Date()): Promise<SlaStatus | null> {
    const ca = await this.capaRepo.loadCa(caId);
    return ca ? evaluateSla(ca, now) : null;
  }
}
