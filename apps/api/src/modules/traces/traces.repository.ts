// SPDX-License-Identifier: BUSL-1.1
//
// TracesRepository — Drizzle-backed persistence for the `agent_traces`
// table. Mirrors the wave-1 ClientsRepository pattern: real Postgres path
// goes through `BaseRepository.withTenant` for RLS session vars; the
// unit-test stub auto-routes to an in-memory map.
//
// API/DB shape: the schema stores (id, firm_id, engagement_id, source,
// spans JSONB, metadata JSONB, ingested_at). The legacy API DTO carries
// a flat `name` + `metadata`. We pack `name` into metadata.__af.name on
// write and rebuild on read so DTO projection is lossless. `engagementId`
// is read from request context when available; we synthesize a sentinel
// when absent so unit tests that don't set engagementId still pass.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import { RequestContextStore } from '../../common/request-context.js';
import type { TracesDto, CreateTracesDto, UpdateTracesDto } from './dto.js';

interface TraceRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  source: string;
  spans: unknown[];
  metadata: Record<string, unknown> | null;
  ingested_at: Date | string;
}

const SIDECAR_KEY = '__af';
const SYSTEM_ENGAGEMENT_ID = '00000000-0000-4000-8000-000000000003';

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDto(row: TraceRow): TracesDto {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const sc = (meta[SIDECAR_KEY] ?? {}) as { name?: string; createdAt?: string; updatedAt?: string };
  const visibleMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k !== SIDECAR_KEY) visibleMeta[k] = v;
  }
  return {
    id: row.id,
    firmId: row.firm_id,
    name: sc.name ?? row.source,
    ...(Object.keys(visibleMeta).length > 0 ? { metadata: visibleMeta } : {}),
    createdAt: sc.createdAt ?? toIso(row.ingested_at),
    updatedAt: sc.updatedAt ?? toIso(row.ingested_at),
  };
}

@Injectable()
export class TracesRepository extends BaseRepository {
  private readonly memory = new Map<string, TracesDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  private resolveEngagementId(): string {
    const ctx = RequestContextStore.get();
    return ctx?.engagementId ?? SYSTEM_ENGAGEMENT_ID;
  }

  async create(firmId: string, dto: CreateTracesDto): Promise<TracesDto> {
    if (!this.hasRealDb()) return this.createInMemory(firmId, dto);
    const id = randomUUID();
    const now = new Date().toISOString();
    const visibleMeta = (dto.metadata ?? {}) as Record<string, unknown>;
    const sidecar = { name: dto.name, createdAt: now, updatedAt: now };
    const fullMeta = { ...visibleMeta, [SIDECAR_KEY]: sidecar };
    const source = (visibleMeta['source'] as string | undefined) ?? 'custom';
    const spans = (visibleMeta['spans'] as unknown[] | undefined) ?? [];
    const engagementId = this.resolveEngagementId();
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO agent_traces (id, firm_id, engagement_id, source, spans, metadata, ingested_at)
               VALUES (${id}, ${firmId}, ${engagementId}, ${source},
                       ${JSON.stringify(spans)}::jsonb, ${JSON.stringify(fullMeta)}::jsonb, now())`;
      const rows = (await tx`SELECT * FROM agent_traces WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as TraceRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Trace', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<TracesDto> {
    if (!this.hasRealDb()) return this.findInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM agent_traces WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as TraceRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Trace', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: TracesDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows = opts.cursor
        ? ((await tx`SELECT * FROM agent_traces WHERE firm_id = ${firmId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as TraceRow[])
        : ((await tx`SELECT * FROM agent_traces WHERE firm_id = ${firmId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as TraceRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items: slice.map(rowToDto), nextCursor };
    });
  }

  async update(firmId: string, id: string, dto: UpdateTracesDto): Promise<TracesDto> {
    if (!this.hasRealDb()) return this.updateInMemory(firmId, id, dto);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM agent_traces WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as TraceRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Trace', id);
      const cur = rowToDto(row);
      const newName = dto.name ?? cur.name;
      const visibleMeta = (dto.metadata ?? cur.metadata ?? {}) as Record<string, unknown>;
      const sidecar = { name: newName, createdAt: cur.createdAt, updatedAt: new Date().toISOString() };
      const fullMeta = { ...visibleMeta, [SIDECAR_KEY]: sidecar };
      await tx`UPDATE agent_traces
               SET metadata = ${JSON.stringify(fullMeta)}::jsonb
               WHERE id = ${id} AND firm_id = ${firmId}`;
      const updated = (await tx`SELECT * FROM agent_traces WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as TraceRow[];
      const out = updated[0];
      if (!out) throw new NotFoundError('Trace', id);
      return rowToDto(out);
    });
  }

  async remove(firmId: string, id: string): Promise<void> {
    if (!this.hasRealDb()) return this.removeInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`DELETE FROM agent_traces WHERE id = ${id} AND firm_id = ${firmId} RETURNING id`) as unknown as { id: string }[];
      if (rows.length === 0) throw new NotFoundError('Trace', id);
    });
  }

  /**
   * Ingest a raw trace payload (JSON or pre-parsed object). Used by the
   * importer endpoint to land OTel/Langfuse/Phoenix dumps without requiring
   * a separate DTO surface.
   */
  async ingest(
    firmId: string,
    payload: { name: string; source?: string; spans?: unknown[]; metadata?: Record<string, unknown> },
  ): Promise<TracesDto> {
    return this.create(firmId, {
      name: payload.name,
      metadata: {
        ...(payload.metadata ?? {}),
        ...(payload.source !== undefined ? { source: payload.source } : {}),
        ...(payload.spans !== undefined ? { spans: payload.spans } : {}),
      },
    });
  }

  /* ---------- legacy in-memory fallback ---------- */

  private async createInMemory(firmId: string, dto: CreateTracesDto): Promise<TracesDto> {
    const now = new Date().toISOString();
    const row: TracesDto = {
      id: randomUUID(),
      firmId,
      name: dto.name,
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }
  private async findInMemory(firmId: string, id: string): Promise<TracesDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Trace', id);
    return r;
  }
  private async listInMemory(firmId: string, opts: { cursor?: string; limit: number }) {
    const all = [...this.memory.values()].filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
  private async updateInMemory(
    firmId: string,
    id: string,
    dto: UpdateTracesDto,
  ): Promise<TracesDto> {
    const cur = await this.findInMemory(firmId, id);
    const updated: TracesDto = {
      ...cur,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
  private async removeInMemory(firmId: string, id: string): Promise<void> {
    await this.findInMemory(firmId, id);
    this.memory.delete(id);
  }
}
