// SPDX-License-Identifier: BUSL-1.1
//
// Evidence-vault repository — Drizzle-shaped wrapper that delegates to
// `@auditforge/evidence-vault`'s `EvidenceRegistry` (and underlying
// `EvidenceRepository` interface). The package's domain object carries
// `sha3_256`, `retainUntil`, `ocrText` etc which the legacy API DTO does
// not expose; we preserve the API DTO shape and forward the canonical
// fields through the registry's `create`.
//
// TODO(rls-migration): swap the in-memory `EvidenceRepository` (provided by
// `EvidenceVaultAdapter`) for a Drizzle-backed implementation once
// `packages/db` exposes `evidence_objects`.

import { Inject, Injectable, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { EvidenceObject } from '@auditforge/evidence-vault';
import type { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { EvidenceVaultAdapter } from '../../adapters/evidence-vault.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type { EvidenceDto, FinalizeUploadDto } from './dto.js';

const TEN_YEARS_DAYS = 365 * 10;
const PLACEHOLDER_AUDITOR = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class EvidenceRepository extends BaseRepository {
  private readonly memory = new Map<string, EvidenceDto>();

  constructor(
    @Inject(PG_CLIENT) sql: postgres.Sql,
    tenancy: TenancyAdapter,
    @Optional() @Inject(EvidenceVaultAdapter) private readonly vault?: EvidenceVaultAdapter,
  ) {
    super(sql, tenancy);
  }

  async insert(
    firmId: string,
    dto: FinalizeUploadDto,
    bucket: string,
  ): Promise<EvidenceDto> {
    if (!this.vault) return this.insertFallback(firmId, dto, bucket);
    const engagementId = dto.engagementId;
    if (!engagementId) {
      // The package's tenant scope requires engagementId; cross-engagement
      // evidence stays in the legacy memory path until the API DTO requires
      // it.
      return this.insertFallback(firmId, dto, bucket);
    }
    const id = randomUUID();
    const now = new Date();
    const retainUntil = new Date(now.getTime() + TEN_YEARS_DAYS * 24 * 3600 * 1000);
    const obj: EvidenceObject = {
      id,
      firmId,
      engagementId,
      filename: dto.filename,
      mimeType: dto.mimeType,
      size: dto.sizeBytes,
      sha256: dto.sha256,
      // sha3_256 not surfaced by the API DTO; reuse sha256 as a placeholder
      // to satisfy the package schema. TODO(rls-migration): require sha3_256
      // upstream once the upload SDK computes it.
      sha3_256: dto.sha256,
      storageKey: dto.objectKey,
      avScanResult: 'pending',
      ocrText: null,
      uploadedBy: PLACEHOLDER_AUDITOR,
      uploadedAt: now.toISOString(),
      retainUntil: retainUntil.toISOString(),
    };
    await this.vault.registry.create(
      { firmId, auditorId: PLACEHOLDER_AUDITOR, engagementId },
      obj,
    );
    const dtoOut: EvidenceDto = {
      id,
      firmId,
      ...(engagementId !== undefined ? { engagementId } : {}),
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      sha256: dto.sha256,
      bucket,
      objectKey: dto.objectKey,
      avStatus: 'uploaded',
      ocrStatus: 'pending',
      createdAt: now.toISOString(),
    };
    this.memory.set(id, dtoOut); // mirror sidecar for read paths
    return dtoOut;
  }

  async findById(firmId: string, id: string): Promise<EvidenceDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Evidence', id);
    return r;
  }

  async list(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: EvidenceDto[]; nextCursor: string | null }> {
    const all = [...this.memory.values()].filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  /* ---------- legacy in-memory fallback ---------- */
  private async insertFallback(
    firmId: string,
    dto: FinalizeUploadDto,
    bucket: string,
  ): Promise<EvidenceDto> {
    const row: EvidenceDto = {
      id: randomUUID(),
      firmId,
      ...(dto.engagementId !== undefined ? { engagementId: dto.engagementId } : {}),
      filename: dto.filename,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      sha256: dto.sha256,
      bucket,
      objectKey: dto.objectKey,
      avStatus: 'uploaded',
      ocrStatus: 'pending',
      createdAt: new Date().toISOString(),
    };
    this.memory.set(row.id, row);
    return row;
  }
}
