// SPDX-License-Identifier: BUSL-1.1
//
// Risks adapter — wires `@auditforge/risks` into the API.
//
// Provides:
//   - Importers (stand-in for risk-register CSV/JSON ingest).
//   - Cross-checks (consistency between SoA, risks, treatments, controls).
//   - Impact assessment domain helpers.
//   - Tenant-scoped registry over the API DTO surface.

import { Inject, Injectable } from '@nestjs/common';
import * as risksPkg from '@auditforge/risks';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { RisksDto, CreateRisksDto, UpdateRisksDto } from '../modules/risks/dto.js';

@Injectable()
export class RisksAdapter {
  /** Re-exported helpers — accessible as `adapter.pkg.<helper>`. */
  readonly pkg = risksPkg;

  readonly registry: TenantScopedRegistry<RisksDto, CreateRisksDto, UpdateRisksDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<RisksDto, CreateRisksDto, UpdateRisksDto>(
      { entity: 'risk', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as RisksDto,
      'Risks',
    );
  }
}
