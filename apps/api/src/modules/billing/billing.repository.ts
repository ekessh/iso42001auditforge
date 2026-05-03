// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { BillingDto, CreateBillingDto, UpdateBillingDto } from './dto.js';

@Injectable()
export class BillingRepository extends BaseRepository {
  private readonly memory = new Map<string, BillingDto>();

  async create(firmId: string, dto: CreateBillingDto): Promise<BillingDto> {
    const now = new Date().toISOString();
    const row: BillingDto = { id: randomUUID(), firmId, name: dto.name, metadata: dto.metadata, createdAt: now, updatedAt: now };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<BillingDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Billing', id);
    return r;
  }

  async list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: BillingDto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: UpdateBillingDto): Promise<BillingDto> {
    const cur = await this.findById(firmId, id);
    const updated: BillingDto = { ...cur, ...dto, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  async remove(firmId: string, id: string): Promise<void> {
    await this.findById(firmId, id);
    this.memory.delete(id);
  }
}
