// SPDX-License-Identifier: BUSL-1.1
//
// FindingsRepository — Drizzle-backed persistence for the `findings` and
// `candidate_findings` tables. Mirrors the wave-1 ClientsRepository shape:
//   - `BaseRepository.withTenant` for RLS session var emission;
//   - in-memory fallback when the injected sql is the unit-test stub.
//
// API/DB shape: the DB schema stores (id, firm_id, engagement_id,
// finding_type, finding_state, title, description, raised_at, resolved_at,
// metadata). The legacy API DTO carries `controlRef`, `severity`, `status`,
// `evidence` — we map `severity` -> `finding_type`, `status` -> the legacy
// state via JSONB, and pack `controlRef` + `evidence` into JSONB metadata
// under a `__af` namespace so DTO projection is lossless.
//
// Severity / state / status mapping:
//   severity: major_nc | minor_nc | ofi | conformity -> finding_type 1:1
//   status: open | capa_pending | capa_in_progress | closed | verified
//     stays in metadata.__af.status (the package's canonical state machine
//     covers `finding_state` separately and is left to the registry).

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type {
  CreateFindingDto,
  FindingDto,
  UpdateFindingDto,
} from './dto.js';

interface FindingRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  finding_type: string;
  finding_state: string;
  title: string;
  description: string | null;
  raised_at: Date | string;
  resolved_at: Date | string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ApiSidecar {
  controlRef: string;
  evidence: string[];
  status: FindingDto['status'];
}

const SIDECAR_KEY = '__af';

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function severityToType(s: string): string {
  switch (s) {
    case 'major_nc':
    case 'minor_nc':
    case 'ofi':
    case 'conformity':
      return s;
    default:
      return 'minor_nc';
  }
}

function rowToDto(row: FindingRow): FindingDto {
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  const sc = (meta[SIDECAR_KEY] ?? {}) as Partial<ApiSidecar>;
  return {
    id: row.id,
    firmId: row.firm_id,
    engagementId: row.engagement_id,
    controlRef: sc.controlRef ?? '',
    severity: row.finding_type,
    title: row.title,
    description: row.description ?? '',
    evidence: [...(sc.evidence ?? [])],
    status: sc.status ?? 'open',
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class FindingsRepository extends BaseRepository {
  private readonly memory = new Map<string, FindingDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async create(firmId: string, dto: CreateFindingDto): Promise<FindingDto> {
    const initialStatus: FindingDto['status'] =
      dto.severity === 'conformity' || dto.severity === 'ofi' ? 'open' : 'capa_pending';
    if (!this.hasRealDb()) return this.createInMemory(firmId, dto, initialStatus);
    const id = randomUUID();
    const sidecar: ApiSidecar = {
      controlRef: dto.controlRef,
      evidence: [...dto.evidence],
      status: initialStatus,
    };
    const meta = { [SIDECAR_KEY]: sidecar };
    const findingType = severityToType(dto.severity);
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO findings
                 (id, firm_id, engagement_id, finding_type, finding_state, title, description, raised_at, metadata)
               VALUES (${id}, ${firmId}, ${dto.engagementId}, ${findingType}, 'draft',
                       ${dto.title}, ${dto.description}, now(), ${JSON.stringify(meta)}::jsonb)`;
      const rows = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Finding', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<FindingDto> {
    if (!this.hasRealDb()) return this.findInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Finding', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: FindingDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows =
        opts.cursor && opts.engagementId
          ? ((await tx`SELECT * FROM findings WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as FindingRow[])
          : opts.engagementId
            ? ((await tx`SELECT * FROM findings WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as FindingRow[])
            : opts.cursor
              ? ((await tx`SELECT * FROM findings WHERE firm_id = ${firmId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as FindingRow[])
              : ((await tx`SELECT * FROM findings WHERE firm_id = ${firmId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as FindingRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(rowToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async update(firmId: string, id: string, dto: UpdateFindingDto): Promise<FindingDto> {
    if (!this.hasRealDb()) return this.updateInMemory(firmId, id, dto);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Finding', id);
      const cur = rowToDto(row);
      const sc: ApiSidecar = {
        controlRef: dto.controlRef ?? cur.controlRef,
        evidence: dto.evidence !== undefined ? [...dto.evidence] : [...cur.evidence],
        status: cur.status,
      };
      const meta = { ...((row.metadata ?? {}) as Record<string, unknown>), [SIDECAR_KEY]: sc };
      const newTitle = dto.title ?? cur.title;
      const newDesc = dto.description ?? cur.description;
      await tx`UPDATE findings
               SET title = ${newTitle}, description = ${newDesc}, metadata = ${JSON.stringify(meta)}::jsonb,
                   updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId}`;
      const updated = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const out = updated[0];
      if (!out) throw new NotFoundError('Finding', id);
      return rowToDto(out);
    });
  }

  async setStatus(
    firmId: string,
    id: string,
    status: FindingDto['status'],
  ): Promise<FindingDto> {
    if (!this.hasRealDb()) return this.setStatusInMemory(firmId, id, status);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Finding', id);
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const sc = (meta[SIDECAR_KEY] ?? {}) as ApiSidecar;
      const updatedMeta = { ...meta, [SIDECAR_KEY]: { ...sc, status } };
      await tx`UPDATE findings
               SET metadata = ${JSON.stringify(updatedMeta)}::jsonb, updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId}`;
      const out = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const r = out[0];
      if (!r) throw new NotFoundError('Finding', id);
      return rowToDto(r);
    });
  }

  /**
   * Promote a candidate finding to a formal finding by inserting into the
   * `findings` table and stamping the candidate row as `promoted`. Returns
   * the new finding DTO.
   */
  async promoteCandidate(
    firmId: string,
    candidateId: string,
    promote: { engagementId: string; severity: string; title: string; description: string; controlRef?: string },
  ): Promise<FindingDto> {
    if (!this.hasRealDb()) {
      return this.create(firmId, {
        engagementId: promote.engagementId,
        controlRef: promote.controlRef ?? 'CF',
        severity: promote.severity as CreateFindingDto['severity'],
        title: promote.title,
        description: promote.description,
        evidence: [],
      });
    }
    const id = randomUUID();
    const initialStatus: FindingDto['status'] =
      promote.severity === 'conformity' || promote.severity === 'ofi' ? 'open' : 'capa_pending';
    const sidecar: ApiSidecar = {
      controlRef: promote.controlRef ?? 'CF',
      evidence: [],
      status: initialStatus,
    };
    const meta = { [SIDECAR_KEY]: sidecar, promotedFromCandidateId: candidateId };
    const findingType = severityToType(promote.severity);
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO findings
                 (id, firm_id, engagement_id, finding_type, finding_state, title, description, raised_at, metadata)
               VALUES (${id}, ${firmId}, ${promote.engagementId}, ${findingType}, 'open',
                       ${promote.title}, ${promote.description}, now(), ${JSON.stringify(meta)}::jsonb)`;
      await tx`UPDATE candidate_findings
               SET status = 'promoted', updated_at = now()
               WHERE id = ${candidateId} AND firm_id = ${firmId}`;
      const rows = (await tx`SELECT * FROM findings WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as FindingRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Finding', id);
      return rowToDto(row);
    });
  }

  /* ---------- legacy in-memory fallback ---------- */

  private async createInMemory(
    firmId: string,
    dto: CreateFindingDto,
    initialStatus: FindingDto['status'],
  ): Promise<FindingDto> {
    const now = new Date().toISOString();
    const row: FindingDto = {
      id: randomUUID(),
      firmId,
      engagementId: dto.engagementId,
      controlRef: dto.controlRef,
      severity: dto.severity,
      title: dto.title,
      description: dto.description,
      evidence: dto.evidence,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }
  private async findInMemory(firmId: string, id: string): Promise<FindingDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Finding', id);
    return r;
  }
  private async listInMemory(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ) {
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
    dto: UpdateFindingDto,
  ): Promise<FindingDto> {
    const cur = await this.findInMemory(firmId, id);
    const updated: FindingDto = {
      ...cur,
      ...(dto.controlRef !== undefined ? { controlRef: dto.controlRef } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.evidence !== undefined ? { evidence: [...dto.evidence] } : {}),
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
  private async setStatusInMemory(
    firmId: string,
    id: string,
    status: FindingDto['status'],
  ): Promise<FindingDto> {
    const cur = await this.findInMemory(firmId, id);
    const updated: FindingDto = { ...cur, status, updatedAt: new Date().toISOString() };
    this.memory.set(id, updated);
    return updated;
  }
}
