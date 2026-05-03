// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateEngagementDto, EngagementDto, UpdateEngagementDto } from './dto.js';

@Injectable()
export class EngagementsRepository extends BaseRepository {
  private readonly memory = new Map<string, EngagementDto>();

  async create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    const now = new Date().toISOString();
    const row: EngagementDto = {
      id: randomUUID(),
      firmId,
      clientId: dto.clientId,
      stage: dto.stage,
      status: 'planned',
      scopeStatement: dto.scopeStatement,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      leadAuditorId: dto.leadAuditorId,
      teamMemberIds: dto.teamMemberIds,
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<EngagementDto> {
    const e = this.memory.get(id);
    if (!e || e.firmId !== firmId) throw new NotFoundError('Engagement', id);
    return e;
  }

  async list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    const cur = await this.findById(firmId, id);
    const updated: EngagementDto = { ...cur, ...dto, updatedAt: new Date().toISOString() } as EngagementDto;
    this.memory.set(id, updated);
    return updated;
  }

  async setStatus(firmId: string, id: string, status: EngagementDto['status']): Promise<EngagementDto> {
    const cur = await this.findById(firmId, id);
    const updated = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }
}
