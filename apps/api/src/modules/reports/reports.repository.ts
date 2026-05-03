// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { CreateReportDto, ReportDto, UpdateReportDto } from './dto.js';

@Injectable()
export class ReportsRepository extends BaseRepository {
  private readonly memory = new Map<string, ReportDto>();

  async create(firmId: string, dto: CreateReportDto): Promise<ReportDto> {
    const now = new Date().toISOString();
    const row: ReportDto = {
      id: randomUUID(), firmId, engagementId: dto.engagementId, kind: dto.kind,
      title: dto.title, bodyMarkdown: dto.bodyMarkdown,
      status: 'draft', version: 1, createdAt: now, updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }

  async findById(firmId: string, id: string): Promise<ReportDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Report', id);
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

  async patch(firmId: string, id: string, dto: UpdateReportDto): Promise<ReportDto> {
    const cur = await this.findById(firmId, id);
    const updated: ReportDto = { ...cur, ...dto, version: cur.version + 1, updatedAt: new Date().toISOString() } as ReportDto;
    this.memory.set(id, updated);
    return updated;
  }

  async sign(firmId: string, id: string, signedBy: string, signatureRef: string): Promise<ReportDto> {
    const cur = await this.findById(firmId, id);
    const updated: ReportDto = {
      ...cur, status: 'issued', signedBy, signatureRef,
      issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
}
