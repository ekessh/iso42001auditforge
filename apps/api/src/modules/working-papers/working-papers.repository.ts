// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateWorkingPaperDto, UpdateWorkingPaperDto, WorkingPaperDto } from './dto.js';

@Injectable()
export class WorkingPapersRepository extends BaseRepository {
  private readonly memory = new Map<string, WorkingPaperDto>();

  async create(firmId: string, dto: CreateWorkingPaperDto): Promise<WorkingPaperDto> {
    const now = new Date().toISOString();
    const row: WorkingPaperDto = {
      id: randomUUID(),
      firmId,
      engagementId: dto.engagementId,
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      title: dto.title,
      controlRef: dto.controlRef,
      bodyMarkdown: dto.bodyMarkdown,
      evidenceRefs: dto.evidenceRefs,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<WorkingPaperDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('WorkingPaper', id);
    return r;
  }

  async list(firmId: string, opts: { engagementId?: string; cursor?: string; limit: number }): Promise<{ items: WorkingPaperDto[]; nextCursor: string | null }> {
    const all = Array.from(this.memory.values()).filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async update(firmId: string, id: string, dto: UpdateWorkingPaperDto): Promise<WorkingPaperDto> {
    const cur = await this.findById(firmId, id);
    const updated = { ...cur, ...dto, version: cur.version + 1, updatedAt: new Date().toISOString() } as WorkingPaperDto;
    this.memory.set(id, updated);
    return updated;
  }

  async setStatus(firmId: string, id: string, status: WorkingPaperDto['status']): Promise<WorkingPaperDto> {
    const cur = await this.findById(firmId, id);
    const updated = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }
}
