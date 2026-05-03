// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateFindingDto, FindingDto, UpdateFindingDto } from './dto.js';

@Injectable()
export class FindingsRepository extends BaseRepository {
  private readonly memory = new Map<string, FindingDto>();

  async create(firmId: string, dto: CreateFindingDto): Promise<FindingDto> {
    const now = new Date().toISOString();
    const initialStatus: FindingDto['status'] = dto.severity === 'conformity' || dto.severity === 'ofi' ? 'open' : 'capa_pending';
    const row: FindingDto = {
      id: randomUUID(), firmId, engagementId: dto.engagementId, controlRef: dto.controlRef,
      severity: dto.severity, title: dto.title, description: dto.description, evidence: dto.evidence,
      status: initialStatus, createdAt: now, updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<FindingDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Finding', id);
    return r;
  }

  async list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }) {
    const all = Array.from(this.memory.values()).filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: UpdateFindingDto): Promise<FindingDto> {
    const cur = await this.findById(firmId, id);
    const updated = { ...cur, ...dto, updatedAt: new Date().toISOString() } as FindingDto;
    this.memory.set(id, updated);
    return updated;
  }

  async setStatus(firmId: string, id: string, status: FindingDto['status']): Promise<FindingDto> {
    const cur = await this.findById(firmId, id);
    const updated = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }
}
