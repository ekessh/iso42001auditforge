// SPDX-License-Identifier: BUSL-1.1
//
// Engagement adapter — wires `@auditforge/engagement` into the API.
//
// Provides:
//   - `EngagementService` from the package (mode immutability + ledger
//     emission for status / stage transitions).
//   - `calculateProgramme` (man-day calculator, IAF MD 5/11/4 + ISO 17021-1).
//   - `buildPlan` (audit plan builder) and `detectPlanConflicts`.
//   - Workflow state machines (Stage1, Stage2, Surveillance, Recertification,
//     Special) for per-stage progression.
//   - Tenant-scoped `engagements` registry that emits `engagement.*` ledger
//     events through the audit-engine adapter.
//
// The API's outer status enum (planned / in_progress / reporting / reviewed /
// issued / archived / cancelled) does NOT match the package's nine-state
// enum 1:1. To avoid a destructive controller-contract change, the adapter
// keeps the API's transition envelope and emits a generic
// `engagement.status_changed` event via the audit-engine adapter — the
// package's `EngagementService.transitionStatus` is reserved for callers
// that already speak the package vocabulary (workflows, programme, plan).
//
// TODO(rls-migration): replace the in-memory engagement registry with the
// Drizzle-backed `engagements` table once `packages/db` ships.

import { Inject, Injectable } from '@nestjs/common';
import {
  EngagementService,
  Stage1Workflow,
  Stage2Workflow,
  SurveillanceWorkflow,
  RecertificationWorkflow,
  SpecialAuditWorkflow,
  calculateProgramme,
  buildPlan,
  detectPlanConflicts,
  type LedgerPort,
  type LedgerEvent as PkgEngagementLedgerEvent,
  type TenantContext as PkgTenantCtx,
} from '@auditforge/engagement';
import type { LedgerEventId } from '@auditforge/shared';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  CreateEngagementDto,
  EngagementDto,
  UpdateEngagementDto,
} from '../modules/engagements/dto.js';

@Injectable()
export class EngagementAdapter {
  /** Package service — owns mode-immutability + status/stage state machines. */
  readonly service: EngagementService;

  /** Tenant-scoped registry over the API DTO surface (preserves controller contract). */
  readonly registry: TenantScopedRegistry<EngagementDto, CreateEngagementDto, UpdateEngagementDto>;

  /** Pure programme calculator (re-exported for the service layer). */
  readonly programme = { calculate: calculateProgramme };

  /** Plan builder + conflict detector (re-exported). */
  readonly plan = { build: buildPlan, detectConflicts: detectPlanConflicts };

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    const ledger = this.makeLedgerPort();
    this.service = new EngagementService(ledger);
    this.registry = new TenantScopedRegistry<EngagementDto, CreateEngagementDto, UpdateEngagementDto>(
      {
        entity: 'engagement',
        payload: (row, lifecycle) => ({
          mode: row.mode,
          stage: row.stage,
          status: row.status,
          lifecycle,
        }),
      },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        clientId: dto.clientId,
        mode: dto.mode,
        stage: dto.stage,
        status: 'planned',
        scopeStatement: dto.scopeStatement,
        startsOn: dto.startsOn,
        endsOn: dto.endsOn,
        leadAuditorId: dto.leadAuditorId,
        teamMemberIds: dto.teamMemberIds,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as EngagementDto,
      'Engagement',
    );
  }

  /**
   * Validate that an update payload does NOT attempt to change the engagement
   * mode (ADR-0013). Delegates to the package's `EngagementService.update`
   * which throws `ModeImmutableError` (HTTP 409). Pure — does not persist.
   */
  assertModeImmutable(current: EngagementDto, patch: UpdateEngagementDto): void {
    // The package's static `update` runs the same defence-in-depth check
    // we previously inlined in the API service. Re-using it keeps the
    // ADR-0013 invariant in one place.
    EngagementService.update(
      {
        id: current.id as never,
        firmId: current.firmId as never,
        clientId: current.clientId as never,
        mode: current.mode,
        // The remaining fields are required by the package type but have
        // no bearing on the immutability check. We supply minimal values.
        lifecycleStage: 'S1',
        status: 'planned',
        scopeStatement: current.scopeStatement,
        startDate: current.startsOn,
        endDate: current.endsOn,
        leadAuditorId: current.leadAuditorId as never,
        teamMemberIds: current.teamMemberIds as never[],
      } as never,
      patch as never,
    );
  }

  /** Update via registry, after mode-immutability check. */
  async updateEngagement(
    firmId: string,
    id: string,
    dto: UpdateEngagementDto,
    actorId: string = 'system',
  ): Promise<EngagementDto> {
    const current = await this.registry.findById(firmId, id);
    // The package's `EngagementService.update` throws on mode-mutation;
    // any error code === 'MODE_IMMUTABLE' is preserved up through the
    // service layer's ConflictError translation.
    this.assertModeImmutable(current, dto);
    return this.registry.update(firmId, id, dto, actorId);
  }

  /** Stage workflow factories — caller supplies the tenant context. */
  stage1Workflow(tenant: PkgTenantCtx): Stage1Workflow {
    return new Stage1Workflow(tenant, this.makeLedgerPort());
  }
  stage2Workflow(tenant: PkgTenantCtx): Stage2Workflow {
    return new Stage2Workflow(tenant, this.makeLedgerPort());
  }
  surveillanceWorkflow(tenant: PkgTenantCtx): SurveillanceWorkflow {
    return new SurveillanceWorkflow(tenant, this.makeLedgerPort());
  }
  recertificationWorkflow(tenant: PkgTenantCtx): RecertificationWorkflow {
    return new RecertificationWorkflow(tenant, this.makeLedgerPort());
  }
  specialWorkflow(
    tenant: PkgTenantCtx,
    subtype: ConstructorParameters<typeof SpecialAuditWorkflow>[0] = 'short_notice',
  ): SpecialAuditWorkflow {
    return new SpecialAuditWorkflow(subtype, tenant, this.makeLedgerPort());
  }

  /**
   * Build a `LedgerPort` that funnels package events into the audit-engine
   * adapter. Each emit becomes a `engagement.*` chain-linked entry.
   */
  private makeLedgerPort(): LedgerPort {
    return {
      emit: async (
        event: Omit<PkgEngagementLedgerEvent, 'id' | 'at'>,
      ): Promise<LedgerEventId> => {
        const evt = await this.audit.append({
          firmId: event.tenant.firmId,
          actorId: event.tenant.auditorId ?? 'system',
          ...(event.tenant.engagementId !== undefined
            ? { engagementId: event.tenant.engagementId }
            : {}),
          type: event.type,
          entity: 'engagement',
          entityId:
            typeof (event.payload as Record<string, unknown>)['engagementId'] === 'string'
              ? ((event.payload as Record<string, unknown>)['engagementId'] as string)
              : 'unknown',
          payload: event.payload as Record<string, unknown>,
        });
        return evt.id as LedgerEventId;
      },
    };
  }
}
