// SPDX-License-Identifier: BUSL-1.1
//
// Probes repository — persistence shim for probe definitions and execution
// records. The actual sandboxed probe runner lives in
// `@auditforge/probe-engine` and is invoked by the BullMQ worker; this
// repository tracks the API-side metadata + queued execution stubs.
//
// TODO(rls-migration): swap the in-memory maps for Drizzle tables once
// `packages/db` exposes `probe_definitions` and `probe_executions`.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CreateProbeDefinitionDto,
  ExecuteProbeDto,
  ProbeDefinitionDto,
  ProbeExecutionDto,
} from './dto.js';

@Injectable()
export class ProbesRepository extends BaseRepository {
  private readonly probes = new Map<string, ProbeDefinitionDto>();
  private readonly executions = new Map<string, ProbeExecutionDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  async createDefinition(
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

  async findDefinition(firmId: string, id: string): Promise<ProbeDefinitionDto> {
    const r = this.probes.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Probe', id);
    return r;
  }

  async listDefinitions(firmId: string, opts: { cursor?: string; limit: number }) {
    const all = [...this.probes.values()].filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  async createExecution(
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

  async findExecution(firmId: string, id: string): Promise<ProbeExecutionDto> {
    const r = this.executions.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('ProbeExecution', id);
    return r;
  }

  async listExecutions(
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

  async sumCostByEngagement(firmId: string, engagementId: string): Promise<number> {
    return [...this.executions.values()]
      .filter((e) => e.firmId === firmId && e.engagementId === engagementId)
      .reduce((s, e) => s + e.costUsd, 0);
  }
}
