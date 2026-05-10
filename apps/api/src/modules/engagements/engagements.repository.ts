// SPDX-License-Identifier: BUSL-1.1
//
// EngagementsRepository — Drizzle-backed persistence for the `engagements`
// table. Mirrors the ClientsRepository pattern from wave 1: real Postgres
// path goes through `BaseRepository.withTenant` so RLS session vars
// (`set_tenant_context($firmId, $auditorId)`) are applied for every query;
// the unit-test stub (`{} as never`) auto-routes to an in-memory
// `EngagementAdapter`-backed registry so the legacy service specs continue
// to pass without a live DB.
//
// API/DB shape bridge: the API DTO carries the rich audit-record shape
// (clientId, mode, stage, status, scopeStatement, startsOn, endsOn,
// leadAuditorId, teamMemberIds, metadata). The physical table only stores
// (firm_id, client_id, code, mode, stage, status, metadata). We pack the
// remaining fields into the JSONB `metadata` column under a reserved
// `__af` namespace so we can rebuild the DTO on read without altering the
// auditee-facing `metadata` payload.
//
// `code` is required by the schema and must be unique per firm; we
// synthesize it from a short id when absent so the API's create endpoint
// stays callable without changing the DTO.

import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import type { EngagementAdapter } from '../../adapters/engagement.adapter.js';
import type {
  CreateEngagementDto,
  EngagementDto,
  UpdateEngagementDto,
} from './dto.js';

interface EngagementRow {
  id: string;
  firm_id: string;
  client_id: string;
  code: string;
  mode: string;
  stage: string;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

interface ApiSidecar {
  scopeStatement: string;
  startsOn: string;
  endsOn: string;
  leadAuditorId: string;
  teamMemberIds: string[];
}

const SIDECAR_KEY = '__af';

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDto(row: EngagementRow): EngagementDto {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const sc = (meta[SIDECAR_KEY] ?? {}) as Partial<ApiSidecar>;
  const visibleMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k !== SIDECAR_KEY) visibleMeta[k] = v;
  }
  return {
    id: row.id,
    firmId: row.firm_id,
    clientId: row.client_id,
    mode: (row.mode as EngagementDto['mode']) ?? 'audit',
    stage: row.stage,
    status: row.status,
    scopeStatement: sc.scopeStatement ?? '',
    startsOn: sc.startsOn ?? '',
    endsOn: sc.endsOn ?? '',
    leadAuditorId: sc.leadAuditorId ?? '',
    teamMemberIds: [...(sc.teamMemberIds ?? [])],
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    ...(Object.keys(visibleMeta).length > 0 ? { metadata: visibleMeta } : {}),
  };
}

@Injectable()
export class EngagementsRepository extends BaseRepository {
  private adapter: EngagementAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as EngagementAdapter | undefined) ?? null;
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  private async ensureAdapter(): Promise<EngagementAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { EngagementAdapter } = await import('../../adapters/engagement.adapter.js');
    this.adapter = new EngagementAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    if (!this.hasRealDb()) {
      const adapter = await this.ensureAdapter();
      return adapter.registry.create(firmId, dto);
    }
    const id = randomUUID();
    const code = `ENG-${id.slice(0, 8)}`;
    const visibleMeta = (dto.metadata ?? {}) as Record<string, unknown>;
    const sidecar: ApiSidecar = {
      scopeStatement: dto.scopeStatement,
      startsOn: dto.startsOn,
      endsOn: dto.endsOn,
      leadAuditorId: dto.leadAuditorId,
      teamMemberIds: [...dto.teamMemberIds],
    };
    const fullMeta = { ...visibleMeta, [SIDECAR_KEY]: sidecar };
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO engagements (id, firm_id, client_id, code, mode, stage, status, metadata)
               VALUES (${id}, ${firmId}, ${dto.clientId}, ${code}, ${dto.mode}, ${dto.stage}, 'planned', ${JSON.stringify(fullMeta)}::jsonb)`;
      const rows = (await tx`SELECT * FROM engagements WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as EngagementRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Engagement', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<EngagementDto> {
    if (!this.hasRealDb()) {
      const adapter = await this.ensureAdapter();
      return adapter.registry.findById(firmId, id);
    }
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM engagements WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as EngagementRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Engagement', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) {
      const adapter = await this.ensureAdapter();
      return adapter.registry.list(firmId, opts);
    }
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows = opts.cursor
        ? ((await tx`SELECT * FROM engagements WHERE firm_id = ${firmId} AND archived_at IS NULL AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as EngagementRow[])
        : ((await tx`SELECT * FROM engagements WHERE firm_id = ${firmId} AND archived_at IS NULL ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as EngagementRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(rowToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    if (!this.hasRealDb()) {
      const adapter = await this.ensureAdapter();
      return adapter.updateEngagement(firmId, id, dto);
    }
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM engagements WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as EngagementRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Engagement', id);
      const cur = rowToDto(row);
      const visibleMeta =
        dto.metadata !== undefined ? dto.metadata : cur.metadata ?? {};
      const sidecar: ApiSidecar = {
        scopeStatement: dto.scopeStatement ?? cur.scopeStatement,
        startsOn: dto.startsOn ?? cur.startsOn,
        endsOn: dto.endsOn ?? cur.endsOn,
        leadAuditorId: dto.leadAuditorId ?? cur.leadAuditorId,
        teamMemberIds: dto.teamMemberIds !== undefined ? [...dto.teamMemberIds] : [...cur.teamMemberIds],
      };
      const fullMeta = { ...(visibleMeta as Record<string, unknown>), [SIDECAR_KEY]: sidecar };
      const newClientId = dto.clientId ?? cur.clientId;
      const newStage = dto.stage ?? cur.stage;
      await tx`UPDATE engagements
               SET client_id = ${newClientId},
                   stage = ${newStage},
                   metadata = ${JSON.stringify(fullMeta)}::jsonb,
                   updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      const updated = (await tx`SELECT * FROM engagements WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as EngagementRow[];
      const out = updated[0];
      if (!out) throw new NotFoundError('Engagement', id);
      return rowToDto(out);
    });
  }

  async setStatus(
    firmId: string,
    id: string,
    status: EngagementDto['status'],
  ): Promise<EngagementDto> {
    if (!this.hasRealDb()) {
      const adapter = await this.ensureAdapter();
      return adapter.registry.update(firmId, id, { status } as never);
    }
    return this.withTenant(async (tx) => {
      await tx`UPDATE engagements
               SET status = ${status}, updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      const rows = (await tx`SELECT * FROM engagements WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as EngagementRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Engagement', id);
      return rowToDto(row);
    });
  }
}
