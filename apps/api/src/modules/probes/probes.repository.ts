// SPDX-License-Identifier: BUSL-1.1
//
// ProbesRepository — Drizzle-backed persistence for probe definitions and
// probe execution records. Reads/writes go through `BaseRepository.withTenant`
// so RLS session vars are applied for every query.
//
// API/DB shape: the API DTO carries `category`, `budgetUsd`, `cpuMs`, `memMb`
// for definitions, and `jobId`, `result`, `costUsd`, `finishedAt` for
// executions. The schema only stores `name`, `mode`, `spec` for definitions
// and `status`, `verdict`, `started_at`, `finished_at`, `output` for
// executions. We pack the auditor-facing extras into the JSONB `spec` /
// `output` blobs so the legacy DTO is a lossless projection.
//
// In-memory fallback for unit tests is auto-selected when the injected
// postgres-js client is the test stub (no `.begin`).

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CreateProbeDefinitionDto,
  ExecuteProbeDto,
  ProbeDefinitionDto,
  ProbeExecutionDto,
} from './dto.js';

interface ProbeDefRow {
  id: string;
  firm_id: string;
  name: string;
  mode: string;
  spec: {
    category: string;
    spec: Record<string, unknown>;
    budgetUsd: number;
    cpuMs: number;
    memMb: number;
  };
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProbeExecRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  probe_definition_id: string;
  status: string;
  verdict: string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  output: { jobId?: string; result?: Record<string, unknown>; costUsd: number };
  created_at: Date | string;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function defToDto(row: ProbeDefRow): ProbeDefinitionDto {
  const spec = row.spec ?? {
    category: 'unknown',
    spec: {},
    budgetUsd: 0,
    cpuMs: 60_000,
    memMb: 512,
  };
  return {
    id: row.id,
    firmId: row.firm_id,
    name: row.name,
    category: spec.category,
    mode: row.mode,
    spec: spec.spec,
    budgetUsd: spec.budgetUsd,
    cpuMs: spec.cpuMs,
    memMb: spec.memMb,
    createdAt: toIso(row.created_at),
  };
}

function execToDto(row: ProbeExecRow): ProbeExecutionDto {
  const out = row.output ?? { costUsd: 0 };
  const dto: ProbeExecutionDto = {
    id: row.id,
    firmId: row.firm_id,
    engagementId: row.engagement_id,
    probeId: row.probe_definition_id,
    status: row.status,
    costUsd: out.costUsd ?? 0,
    createdAt: toIso(row.created_at),
  };
  if (out.jobId) dto.jobId = out.jobId;
  if (out.result) dto.result = out.result;
  if (row.finished_at) dto.finishedAt = toIso(row.finished_at);
  return dto;
}

@Injectable()
export class ProbesRepository extends BaseRepository {
  private readonly probes = new Map<string, ProbeDefinitionDto>();
  private readonly executions = new Map<string, ProbeExecutionDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async createDefinition(
    firmId: string,
    dto: CreateProbeDefinitionDto,
  ): Promise<ProbeDefinitionDto> {
    if (!this.hasRealDb()) return this.createDefInMemory(firmId, dto);
    const id = randomUUID();
    const spec = {
      category: dto.category,
      spec: dto.spec,
      budgetUsd: dto.budgetUsd,
      cpuMs: dto.cpuMs,
      memMb: dto.memMb,
    };
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO probe_definitions (id, firm_id, name, mode, spec)
               VALUES (${id}, ${firmId}, ${dto.name}, ${dto.mode}, ${JSON.stringify(spec)}::jsonb)`;
      const rows = (await tx`SELECT * FROM probe_definitions WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ProbeDefRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Probe', id);
      return defToDto(row);
    });
  }

  async findDefinition(firmId: string, id: string): Promise<ProbeDefinitionDto> {
    if (!this.hasRealDb()) return this.findDefInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM probe_definitions WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ProbeDefRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Probe', id);
      return defToDto(row);
    });
  }

  async listDefinitions(firmId: string, opts: { cursor?: string; limit: number }) {
    if (!this.hasRealDb()) return this.listDefInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows = opts.cursor
        ? ((await tx`SELECT * FROM probe_definitions WHERE firm_id = ${firmId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeDefRow[])
        : ((await tx`SELECT * FROM probe_definitions WHERE firm_id = ${firmId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeDefRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(defToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async createExecution(
    firmId: string,
    probeId: string,
    dto: ExecuteProbeDto,
    jobId: string,
  ): Promise<ProbeExecutionDto> {
    if (!this.hasRealDb()) return this.createExecInMemory(firmId, probeId, dto, jobId);
    const id = randomUUID();
    const output = { jobId, costUsd: 0 };
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO probe_executions (id, firm_id, engagement_id, probe_definition_id, status, output)
               VALUES (${id}, ${firmId}, ${dto.engagementId}, ${probeId}, 'queued', ${JSON.stringify(output)}::jsonb)`;
      const rows = (await tx`SELECT * FROM probe_executions WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ProbeExecRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('ProbeExecution', id);
      return execToDto(row);
    });
  }

  async findExecution(firmId: string, id: string): Promise<ProbeExecutionDto> {
    if (!this.hasRealDb()) return this.findExecInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM probe_executions WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ProbeExecRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('ProbeExecution', id);
      return execToDto(row);
    });
  }

  async listExecutions(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ) {
    if (!this.hasRealDb()) return this.listExecInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      let rows: ProbeExecRow[];
      if (opts.cursor && opts.engagementId) {
        rows = (await tx`SELECT * FROM probe_executions WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeExecRow[];
      } else if (opts.cursor) {
        rows = (await tx`SELECT * FROM probe_executions WHERE firm_id = ${firmId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeExecRow[];
      } else if (opts.engagementId) {
        rows = (await tx`SELECT * FROM probe_executions WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeExecRow[];
      } else {
        rows = (await tx`SELECT * FROM probe_executions WHERE firm_id = ${firmId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ProbeExecRow[];
      }
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(execToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async sumCostByEngagement(firmId: string, engagementId: string): Promise<number> {
    if (!this.hasRealDb()) {
      return [...this.executions.values()]
        .filter((e) => e.firmId === firmId && e.engagementId === engagementId)
        .reduce((s, e) => s + e.costUsd, 0);
    }
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT COALESCE(SUM((output->>'costUsd')::numeric), 0)::float8 AS sum
                             FROM probe_executions
                             WHERE firm_id = ${firmId} AND engagement_id = ${engagementId}`) as unknown as { sum: number }[];
      return rows[0]?.sum ?? 0;
    });
  }

  // ---------------- in-memory fallback ----------------

  private async createDefInMemory(
    firmId: string,
    dto: CreateProbeDefinitionDto,
  ): Promise<ProbeDefinitionDto> {
    const row: ProbeDefinitionDto = {
      id: randomUUID(),
      firmId,
      name: dto.name,
      category: dto.category,
      mode: dto.mode,
      spec: dto.spec,
      budgetUsd: dto.budgetUsd,
      cpuMs: dto.cpuMs,
      memMb: dto.memMb,
      createdAt: new Date().toISOString(),
    };
    this.probes.set(row.id, row);
    return row;
  }
  private async findDefInMemory(firmId: string, id: string): Promise<ProbeDefinitionDto> {
    const r = this.probes.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Probe', id);
    return r;
  }
  private async listDefInMemory(firmId: string, opts: { cursor?: string; limit: number }) {
    const all = [...this.probes.values()].filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
  private async createExecInMemory(
    firmId: string,
    probeId: string,
    dto: ExecuteProbeDto,
    jobId: string,
  ): Promise<ProbeExecutionDto> {
    const row: ProbeExecutionDto = {
      id: randomUUID(),
      firmId,
      engagementId: dto.engagementId,
      probeId,
      status: 'queued',
      jobId,
      costUsd: 0,
      createdAt: new Date().toISOString(),
    };
    this.executions.set(row.id, row);
    return row;
  }
  private async findExecInMemory(firmId: string, id: string): Promise<ProbeExecutionDto> {
    const r = this.executions.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('ProbeExecution', id);
    return r;
  }
  private async listExecInMemory(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ) {
    const all = [...this.executions.values()].filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
}
