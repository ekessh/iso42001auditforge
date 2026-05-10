// SPDX-License-Identifier: BUSL-1.1
//
// ReportsRepository — Drizzle-backed persistence for the `audit_reports`
// table. RLS session vars are applied per-request via
// `BaseRepository.withTenant`.
//
// API/DB shape: the API DTO carries `kind`, `title`, `bodyMarkdown`,
// `version`, `signedBy`, `signatureRef`, `issuedAt`. The physical table has a
// canonical `report_type`, `state`, `payload` JSONB blob, plus signed/issued
// timestamps. We pack the auditor-facing fields (title, bodyMarkdown,
// version, signedBy, signatureRef) into the JSONB column so the legacy DTO
// is a lossless projection. State machine reuses the table's `state` column.
//
// Status enum mapping (API <-> DB):
//   'draft'    <-> 'draft'
//   'in_review'<-> 'in_review'
//   'reviewed' <-> 'signed'   (auditor-signed, awaiting issue)
//   'issued'   <-> 'issued'
//   'archived' <-> 'superseded'
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
import type { CreateReportDto, ReportDto, UpdateReportDto } from './dto.js';

interface ReportPayload {
  title: string;
  bodyMarkdown: string;
  version: number;
  signedBy?: string;
  signatureRef?: string;
}

interface ReportRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  report_type: string;
  state: string;
  payload: ReportPayload;
  created_at: Date | string;
  updated_at: Date | string;
  signed_at: Date | string | null;
  issued_at: Date | string | null;
}

const DB_TO_API_STATE: Record<string, ReportDto['status']> = {
  draft: 'draft',
  in_review: 'in_review',
  signed: 'reviewed',
  issued: 'issued',
  superseded: 'archived',
};

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDto(row: ReportRow): ReportDto {
  const status = DB_TO_API_STATE[row.state] ?? 'draft';
  const payload = row.payload ?? { title: '', bodyMarkdown: '', version: 1 };
  return {
    id: row.id,
    firmId: row.firm_id,
    engagementId: row.engagement_id,
    kind: row.report_type,
    title: payload.title,
    bodyMarkdown: payload.bodyMarkdown,
    status,
    version: payload.version,
    ...(payload.signedBy ? { signedBy: payload.signedBy } : {}),
    ...(payload.signatureRef ? { signatureRef: payload.signatureRef } : {}),
    ...(row.issued_at ? { issuedAt: toIso(row.issued_at) } : {}),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class ReportsRepository extends BaseRepository {
  private readonly memory = new Map<string, ReportDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async create(firmId: string, dto: CreateReportDto): Promise<ReportDto> {
    if (!this.hasRealDb()) return this.createInMemory(firmId, dto);
    const id = randomUUID();
    const payload: ReportPayload = {
      title: dto.title,
      bodyMarkdown: dto.bodyMarkdown,
      version: 1,
    };
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO audit_reports (id, firm_id, engagement_id, report_type, state, payload)
               VALUES (${id}, ${firmId}, ${dto.engagementId}, ${dto.kind}, 'draft', ${JSON.stringify(payload)}::jsonb)`;
      const rows = (await tx`SELECT * FROM audit_reports WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ReportRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Report', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<ReportDto> {
    if (!this.hasRealDb()) return this.findInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM audit_reports WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ReportRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Report', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ): Promise<{ items: ReportDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      let rows: ReportRow[];
      if (opts.cursor && opts.engagementId) {
        rows = (await tx`SELECT * FROM audit_reports WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ReportRow[];
      } else if (opts.cursor) {
        rows = (await tx`SELECT * FROM audit_reports WHERE firm_id = ${firmId} AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ReportRow[];
      } else if (opts.engagementId) {
        rows = (await tx`SELECT * FROM audit_reports WHERE firm_id = ${firmId} AND engagement_id = ${opts.engagementId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ReportRow[];
      } else {
        rows = (await tx`SELECT * FROM audit_reports WHERE firm_id = ${firmId} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ReportRow[];
      }
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(rowToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async patch(firmId: string, id: string, dto: UpdateReportDto): Promise<ReportDto> {
    if (!this.hasRealDb()) return this.patchInMemory(firmId, id, dto);
    return this.withTenant(async (tx) => {
      const cur = await this.findByIdInTx(tx, firmId, id);
      const newPayload: ReportPayload = {
        title: dto.title ?? cur.title,
        bodyMarkdown: dto.bodyMarkdown ?? cur.bodyMarkdown,
        version: cur.version + 1,
        ...(cur.signedBy !== undefined ? { signedBy: cur.signedBy } : {}),
        ...(cur.signatureRef !== undefined ? { signatureRef: cur.signatureRef } : {}),
      };
      await tx`UPDATE audit_reports
               SET payload = ${JSON.stringify(newPayload)}::jsonb,
                   report_type = ${dto.kind ?? cur.kind},
                   updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId}`;
      const rows = (await tx`SELECT * FROM audit_reports WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ReportRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Report', id);
      return rowToDto(row);
    });
  }

  async sign(
    firmId: string,
    id: string,
    signedBy: string,
    signatureRef: string,
  ): Promise<ReportDto> {
    if (!this.hasRealDb()) return this.signInMemory(firmId, id, signedBy, signatureRef);
    return this.withTenant(async (tx) => {
      const cur = await this.findByIdInTx(tx, firmId, id);
      const newPayload: ReportPayload = {
        title: cur.title,
        bodyMarkdown: cur.bodyMarkdown,
        version: cur.version,
        signedBy,
        signatureRef,
      };
      await tx`UPDATE audit_reports
               SET state = 'issued',
                   payload = ${JSON.stringify(newPayload)}::jsonb,
                   signed_at = now(),
                   issued_at = now(),
                   updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId}`;
      const rows = (await tx`SELECT * FROM audit_reports WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ReportRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Report', id);
      return rowToDto(row);
    });
  }

  private async findByIdInTx(
    tx: postgres.TransactionSql,
    firmId: string,
    id: string,
  ): Promise<ReportDto> {
    const rows = (await tx`SELECT * FROM audit_reports WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ReportRow[];
    const row = rows[0];
    if (!row) throw new NotFoundError('Report', id);
    return rowToDto(row);
  }

  // ---------------- in-memory fallback ----------------

  private async createInMemory(firmId: string, dto: CreateReportDto): Promise<ReportDto> {
    const now = new Date().toISOString();
    const row: ReportDto = {
      id: randomUUID(),
      firmId,
      engagementId: dto.engagementId,
      kind: dto.kind,
      title: dto.title,
      bodyMarkdown: dto.bodyMarkdown,
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.memory.set(row.id, row);
    return row;
  }

  private async findInMemory(firmId: string, id: string): Promise<ReportDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Report', id);
    return r;
  }

  private async listInMemory(
    firmId: string,
    opts: { engagementId?: string; cursor?: string; limit: number },
  ) {
    const all = Array.from(this.memory.values()).filter(
      (r) => r.firmId === firmId && (!opts.engagementId || r.engagementId === opts.engagementId),
    );
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }

  private async patchInMemory(
    firmId: string,
    id: string,
    dto: UpdateReportDto,
  ): Promise<ReportDto> {
    const cur = await this.findInMemory(firmId, id);
    const updated: ReportDto = {
      ...cur,
      ...dto,
      version: cur.version + 1,
      updatedAt: new Date().toISOString(),
    } as ReportDto;
    this.memory.set(id, updated);
    return updated;
  }

  private async signInMemory(
    firmId: string,
    id: string,
    signedBy: string,
    signatureRef: string,
  ): Promise<ReportDto> {
    const cur = await this.findInMemory(firmId, id);
    const updated: ReportDto = {
      ...cur,
      status: 'issued',
      signedBy,
      signatureRef,
      issuedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.memory.set(id, updated);
    return updated;
  }
}
