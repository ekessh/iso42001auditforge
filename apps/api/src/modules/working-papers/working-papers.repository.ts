// SPDX-License-Identifier: BUSL-1.1
//
// WorkingPapersRepository — Drizzle-backed persistence for the
// `working_papers` table. Mirrors the wave-1 ClientsRepository pattern:
// real Postgres path goes through `BaseRepository.withTenant` for RLS
// session vars; the unit-test stub auto-routes to an in-memory map.
//
// API/DB shape: the schema stores (id, firm_id, engagement_id, title,
// verdict, body JSONB, crdt_state BYTEA). The legacy API DTO carries
// `templateId / controlRef / bodyMarkdown / evidenceRefs / status /
// version`. We pack the API-side fields into the JSONB `body` column under
// a reserved `__af` namespace so the DTO projection is lossless.
//
// CRDT state (`crdt_state`) is owned by Agent G's Yjs sync work; this
// repository never reads or writes it.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CreateWorkingPaperDto,
  EvidenceRefDto,
  UpdateWorkingPaperDto,
  WorkingPaperDto,
} from './dto.js';

interface WpRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  title: string;
  verdict: string | null;
  body: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

interface ApiSidecar {
  templateId?: string;
  controlRef: string;
  bodyMarkdown: string;
  evidenceRefs: EvidenceRefDto[];
  status: WorkingPaperDto['status'];
  version: number;
}

const SIDECAR_KEY = '__af';

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDto(row: WpRow): WorkingPaperDto {
  const body = (row.body ?? {}) as Record<string, unknown>;
  const sc = (body[SIDECAR_KEY] ?? {}) as Partial<ApiSidecar>;
  return {
    id: row.id,
    firmId: row.firm_id,
    engagementId: row.engagement_id,
    ...(sc.templateId !== undefined ? { templateId: sc.templateId } : {}),
    title: row.title,
    controlRef: sc.controlRef ?? '',
    bodyMarkdown: sc.bodyMarkdown ?? '',
    evidenceRefs: [...(sc.evidenceRefs ?? [])],
    status: sc.status ?? 'draft',
    version: sc.version ?? 1,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class WorkingPapersRepository extends BaseRepository {
  private readonly memory = new Map<string, WorkingPaperDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async create(firmId: string, dto: CreateWorkingPaperDto): Promise<WorkingPaperDto> {
    if (!this.hasRealDb()) return this.createInMemory(firmId, dto);
    const id = randomUUID();
    const sidecar: ApiSidecar = {
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      controlRef: dto.controlRef,
      bodyMarkdown: dto.bodyMarkdown,
      evidenceRefs: [...dto.evidenceRefs],
      status: 'draft',
      version: 1,
    };
    const body = { [SIDECAR_KEY]: sidecar };
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO working_papers (id, firm_id, engagement_id, title, body)
               VALUES (${id}, ${firmId}, ${dto.engagementId}, ${dto.title},
                       ${JSON.stringify(body)}::jsonb)`;
      const rows = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as WpRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('WorkingPaper', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<WorkingPaperDto> {
    if (!this.hasRealDb()) return this.findInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as WpRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('WorkingPaper', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: WorkingPaperDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows =
        opts.cursor && opts.engagementId
          ? ((await tx`SELECT * FROM working_papers WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} AND archived_at IS NULL AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as WpRow[])
          : opts.engagementId
            ? ((await tx`SELECT * FROM working_papers WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} AND archived_at IS NULL ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as WpRow[])
            : opts.cursor
              ? ((await tx`SELECT * FROM working_papers WHERE firm_id = ${firmId} AND archived_at IS NULL AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as WpRow[])
              : ((await tx`SELECT * FROM working_papers WHERE firm_id = ${firmId} AND archived_at IS NULL ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as WpRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(rowToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async update(
    firmId: string,
    id: string,
    dto: UpdateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    if (!this.hasRealDb()) return this.updateInMemory(firmId, id, dto);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as WpRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('WorkingPaper', id);
      const cur = rowToDto(row);
      const updatedSidecar: ApiSidecar = {
        ...(dto.templateId !== undefined ? { templateId: dto.templateId } : cur.templateId !== undefined ? { templateId: cur.templateId } : {}),
        controlRef: dto.controlRef ?? cur.controlRef,
        bodyMarkdown: dto.bodyMarkdown ?? cur.bodyMarkdown,
        evidenceRefs: dto.evidenceRefs !== undefined ? [...dto.evidenceRefs] : [...cur.evidenceRefs],
        status: cur.status,
        version: cur.version + 1,
      };
      const body = { ...((row.body ?? {}) as Record<string, unknown>), [SIDECAR_KEY]: updatedSidecar };
      const newTitle = dto.title ?? cur.title;
      await tx`UPDATE working_papers
               SET title = ${newTitle}, body = ${JSON.stringify(body)}::jsonb, updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      const updated = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as WpRow[];
      const out = updated[0];
      if (!out) throw new NotFoundError('WorkingPaper', id);
      return rowToDto(out);
    });
  }

  async setStatus(
    firmId: string,
    id: string,
    status: WorkingPaperDto['status'],
  ): Promise<WorkingPaperDto> {
    if (!this.hasRealDb()) return this.setStatusInMemory(firmId, id, status);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as WpRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('WorkingPaper', id);
      const body = (row.body ?? {}) as Record<string, unknown>;
      const sc = (body[SIDECAR_KEY] ?? {}) as ApiSidecar;
      const updatedBody = { ...body, [SIDECAR_KEY]: { ...sc, status } };
      await tx`UPDATE working_papers
               SET body = ${JSON.stringify(updatedBody)}::jsonb, updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      const updated = (await tx`SELECT * FROM working_papers WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as WpRow[];
      const out = updated[0];
      if (!out) throw new NotFoundError('WorkingPaper', id);
      return rowToDto(out);
    });
  }

  /* ---------- legacy in-memory fallback ---------- */

  private async createInMemory(
    firmId: string,
    dto: CreateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
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
  private async findInMemory(firmId: string, id: string): Promise<WorkingPaperDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('WorkingPaper', id);
    return r;
  }
  private async listInMemory(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: WorkingPaperDto[]; nextCursor: string | null }> {
    const all = [...this.memory.values()].filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
  private async updateInMemory(
    firmId: string,
    id: string,
    dto: UpdateWorkingPaperDto,
  ): Promise<WorkingPaperDto> {
    const cur = await this.findInMemory(firmId, id);
    if (cur.status === 'final') throw new ConflictError('Working paper is final');
    const updated: WorkingPaperDto = {
      ...cur,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.controlRef !== undefined ? { controlRef: dto.controlRef } : {}),
      ...(dto.bodyMarkdown !== undefined ? { bodyMarkdown: dto.bodyMarkdown } : {}),
      ...(dto.evidenceRefs !== undefined ? { evidenceRefs: dto.evidenceRefs } : {}),
      ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
      version: cur.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
  private async setStatusInMemory(
    firmId: string,
    id: string,
    status: WorkingPaperDto['status'],
  ): Promise<WorkingPaperDto> {
    const cur = await this.findInMemory(firmId, id);
    if (cur.status === 'final' && status !== 'final') {
      throw new ConflictError('Working paper is final');
    }
    const updated: WorkingPaperDto = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }
}
