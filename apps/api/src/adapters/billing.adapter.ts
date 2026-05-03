// SPDX-License-Identifier: BUSL-1.1
//
// Billing adapter — wires `@auditforge/billing` into the API.
//
// Provides:
//   - `rollup`        (per-engagement labour + expense rollup).
//   - Tax / FX / productivity helpers (re-exported from the package).
//   - Tenant-scoped registry over the API DTO surface.

import { Inject, Injectable } from '@nestjs/common';
import * as billingPkg from '@auditforge/billing';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { BillingDto, CreateBillingDto, UpdateBillingDto } from '../modules/billing/dto.js';

@Injectable()
export class BillingAdapter {
  /** Pure helpers re-exported as `adapter.pkg.<helper>`. */
  readonly pkg = billingPkg;

  readonly registry: TenantScopedRegistry<BillingDto, CreateBillingDto, UpdateBillingDto>;

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.registry = new TenantScopedRegistry<BillingDto, CreateBillingDto, UpdateBillingDto>(
      { entity: 'billing', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as BillingDto,
      'Billing',
    );
  }
}
