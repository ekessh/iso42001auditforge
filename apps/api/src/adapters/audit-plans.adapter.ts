// SPDX-License-Identifier: BUSL-1.1
//
// Audit-plans adapter — re-uses `@auditforge/engagement` for plan tooling.
//
// Provides:
//   - `buildPlan`              (audit plan builder).
//   - `detectPlanConflicts`    (resource / time conflict detector).
//   - `applyPlanMove`          (apply a session move with conflict guard).
//   - `PlanReceiptStateMachine`(auditee acceptance state machine).
//   - Tenant-scoped registry over the API DTO surface.
//
// The engagement workflow scaffolds (Stage1Workflow / Stage2Workflow / etc.)
// are exposed via the EngagementAdapter; the audit-plans module focuses on
// the plan aggregate.

import { Inject, Injectable } from '@nestjs/common';
import {
  buildPlan,
  detectPlanConflicts,
  applyPlanMove,
  PlanReceiptStateMachine,
} from '@auditforge/engagement';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type {
  AuditPlansDto,
  CreateAuditPlansDto,
  UpdateAuditPlansDto,
} from '../modules/audit-plans/dto.js';

@Injectable()
export class AuditPlansAdapter {
  readonly plan = {
    build: buildPlan,
    detectConflicts: detectPlanConflicts,
    applyMove: applyPlanMove,
  };
  readonly receipt = PlanReceiptStateMachine;

  readonly registry: TenantScopedRegistry<AuditPlansDto, CreateAuditPlansDto, UpdateAuditPlansDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<AuditPlansDto, CreateAuditPlansDto, UpdateAuditPlansDto>(
      { entity: 'audit-plan', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as AuditPlansDto,
      'AuditPlans',
    );
  }
}
