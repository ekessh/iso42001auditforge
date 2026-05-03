// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { CapaDto, CreateCapaDto, UpdateCapaDto } from './dto.js';

@Injectable()
export class CapaRepository extends BaseRepository {
  private readonly memory = new Map<string, CapaDto>();

  async create(firmId: string, dto: CreateCapaDto): Promise<CapaDto> {
    const now = new Date().toISOString();
    const row: CapaDto = { id: randomUUID(), firmId, name: dto.name, metadata: dto.metadata, createdAt: now, updatedAt: now };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<CapaDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Capa', id);
    return r;
  }

  async list(firmId: string, opts: { cursor?: string; limit: number }): Promise<{ items: CapaDto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: UpdateCapaDto): Promise<CapaDto> {
    const cur = await this.findById(firmId, id);
    const updated: CapaDto = { ...cur, ...dto, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }

  async remove(firmId: string, id: string): Promise<void> {
    await this.findById(firmId, id);
    this.memory.delete(id);
  }
}
