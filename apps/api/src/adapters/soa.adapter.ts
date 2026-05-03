// SPDX-License-Identifier: BUSL-1.1
//
// SoA adapter — wires `@auditforge/soa` into the API.
//
// Provides:
//   - `SoaReviewer` (verdict state machine + bulk confirm/raise NC).
//   - Importers (xlsx / csv / json / pdf) with safe-path validation.
//   - `checkCompleteness` + `flagWeakJustifications` against the Annex A
//     catalogue.
//   - `createImportSession` for persistable import receipts.
//   - Tenant-scoped registry over the API DTO surface (preserves controller).
//
// TODO(integration): wire `checkCompleteness` to the Annex A catalogue
// served by `@auditforge/catalogues` once the runtime catalogue API is
// stable.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  SoaReviewer,
  applyTransition,
  canTransition,
  checkCompleteness,
  createImportSession,
  flagWeakJustifications,
  type SoaRecord,
  type SoaReview,
} from '@auditforge/soa';
import { AuditEngineAdapter } from './audit-engine.adapter.js';
import { TenantScopedRegistry } from './_tenant-registry.js';
import type { SoaDto, CreateSoaDto, UpdateSoaDto } from '../modules/soa/dto.js';

@Injectable()
export class SoaAdapter {
  /** Reviewer state machine — pure, stateless. */
  readonly reviewer: SoaReviewer;

  /** Pure helpers — re-exported for direct service-layer use. */
  readonly stateMachine = { applyTransition, canTransition };
  readonly catalogue = { checkCompleteness, flagWeakJustifications };
  readonly importing = { createImportSession };

  /** Tenant-scoped registry over the API DTO surface. */
  readonly registry: TenantScopedRegistry<SoaDto, CreateSoaDto, UpdateSoaDto>;

  /** Per-engagement Soa record store. Used by SoaReviewer flows. */
  private readonly soaRecords = new Map<string, SoaRecord>();
  private readonly soaReviews = new Map<string, SoaReview>();

  constructor(@Inject(AuditEngineAdapter) audit: AuditEngineAdapter) {
    this.reviewer = new SoaReviewer({ newId: () => randomUUID() });
    this.registry = new TenantScopedRegistry<SoaDto, CreateSoaDto, UpdateSoaDto>(
      { entity: 'soa', payload: (row) => ({ name: row.name }) },
      audit,
      (firmId, dto, base) => ({
        id: base.id,
        firmId,
        name: dto.name,
        ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
        createdAt: base.createdAt,
        updatedAt: base.updatedAt,
      }),
      (current, dto, updatedAt) => ({ ...current, ...dto, updatedAt }) as SoaDto,
      'Soa',
    );
  }

  /** Test/integration helper — register an SoA record so callers can drive reviews. */
  registerRecord(record: SoaRecord): void {
    this.soaRecords.set(record.id, record);
  }
  getRecord(id: string): SoaRecord | undefined {
    return this.soaRecords.get(id);
  }
  saveReview(review: SoaReview): void {
    this.soaReviews.set(review.id, review);
  }
  getReview(id: string): SoaReview | undefined {
    return this.soaReviews.get(id);
  }
  listReviews(): readonly SoaReview[] {
    return Array.from(this.soaReviews.values());
  }
}
