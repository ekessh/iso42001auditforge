// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { EvidenceDto, FinalizeUploadDto } from './dto.js';

@Injectable()
export class EvidenceRepository extends BaseRepository {
  private readonly memory = new Map<string, EvidenceDto>();

  async insert(firmId: string, dto: FinalizeUploadDto, bucket: string): Promise<EvidenceDto> {
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

  async findById(firmId: string, id: string): Promise<EvidenceDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Evidence', id);
    return r;
  }

  async list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }): Promise<{ items: EvidenceDto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
}
