// SPDX-License-Identifier: BUSL-1.1
//
// ClientsRepository — Drizzle-backed persistence for the `clients` table.
// Reads / writes go through `BaseRepository.withTenant` so RLS session vars
// (`set_tenant_context($firmId, $auditorId)`) are applied for every query.
//
// API/DB shape bridge: the API DTO carries `name` + opaque `metadata`. The
// physical table requires `legal_name` + `country_code` (ISO 17021-1 audit
// records need both). We map `name -> legal_name`, store `metadata` verbatim
// on the JSONB column, and persist `country_code` from `metadata.countryCode`
// when present, else a sentinel `'XX'` which the admin UI surfaces as
// "unset". Soft-delete uses `archived_at`; deletion is never destructive at
// this layer.
//
// When `PG_CLIENT` is the postgres-js stub used in unit tests (no real DB),
// `withTenant` would throw on `sql.begin`, so the repository auto-detects
// the stub and falls back to an in-memory Map — selecting on whether
// `this.sql.begin` is callable. Production always uses the real client.

import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import type { TenancyAdapter } from '../../adapters/tenancy.adapter.js';
import { BaseRepository } from '../../db/base.repository.js';
import { NotFoundError } from '../../common/errors.js';
import { PG_CLIENT } from '../../db/db.module.js';
import type { ClientsDto, CreateClientsDto, UpdateClientsDto } from './dto.js';

interface ClientRow {
  id: string;
  firm_id: string;
  legal_name: string;
  country_code: string;
  metadata: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
  archived_at: Date | string | null;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function rowToDto(row: ClientRow): ClientsDto {
  return {
    id: row.id,
    firmId: row.firm_id,
    name: row.legal_name,
    metadata: { ...row.metadata, countryCode: row.country_code },
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class ClientsRepository extends BaseRepository {
  // Legacy in-memory fallback for unit tests that wire `({} as never, tenancy)`
  // without a real Postgres. Production never hits this path.
  private readonly memory = new Map<string, ClientsDto>();

  constructor(@Inject(PG_CLIENT) sql: postgres.Sql, tenancy: TenancyAdapter) {
    super(sql, tenancy);
  }

  private hasRealDb(): boolean {
    // postgres-js exposes `.begin` as a function on a real client; the
    // unit-test stub (`{} as never`) does not. Auto-detect to keep tests fast.
    return typeof (this.sql as unknown as { begin?: unknown }).begin === 'function';
  }

  async create(firmId: string, dto: CreateClientsDto): Promise<ClientsDto> {
    if (!this.hasRealDb()) return this.createInMemory(firmId, dto);
    const meta = (dto.metadata ?? {}) as Record<string, unknown>;
    const countryCode =
      typeof meta['countryCode'] === 'string' ? (meta['countryCode'] as string) : 'XX';
    const id = randomUUID();
    return this.withTenant(async (tx) => {
      await tx`INSERT INTO clients (id, firm_id, legal_name, country_code, metadata)
               VALUES (${id}, ${firmId}, ${dto.name}, ${countryCode}, ${JSON.stringify(meta)}::jsonb)`;
      const rows = (await tx`SELECT * FROM clients WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ClientRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Clients', id);
      return rowToDto(row);
    });
  }

  async findById(firmId: string, id: string): Promise<ClientsDto> {
    if (!this.hasRealDb()) return this.findInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      const rows = (await tx`SELECT * FROM clients WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as ClientRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Clients', id);
      return rowToDto(row);
    });
  }

  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: ClientsDto[]; nextCursor: string | null }> {
    if (!this.hasRealDb()) return this.listInMemory(firmId, opts);
    const limitPlusOne = opts.limit + 1;
    return this.withTenant(async (tx) => {
      const rows = opts.cursor
        ? ((await tx`SELECT * FROM clients WHERE firm_id = ${firmId} AND archived_at IS NULL AND id > ${opts.cursor} ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ClientRow[])
        : ((await tx`SELECT * FROM clients WHERE firm_id = ${firmId} AND archived_at IS NULL ORDER BY id ASC LIMIT ${limitPlusOne}`) as unknown as ClientRow[]);
      const hasMore = rows.length > opts.limit;
      const slice = rows.slice(0, opts.limit);
      const items = slice.map(rowToDto);
      const nextCursor = hasMore ? slice[slice.length - 1]?.id ?? null : null;
      return { items, nextCursor };
    });
  }

  async update(firmId: string, id: string, dto: UpdateClientsDto): Promise<ClientsDto> {
    if (!this.hasRealDb()) return this.updateInMemory(firmId, id, dto);
    return this.withTenant(async (tx) => {
      const cur = await this.findByIdInTx(tx, firmId, id);
      const meta = (dto.metadata ?? cur.metadata ?? {}) as Record<string, unknown>;
      const countryCode =
        typeof meta['countryCode'] === 'string' ? (meta['countryCode'] as string) : null;
      const newName = dto.name ?? cur.name;
      if (countryCode !== null) {
        await tx`UPDATE clients
                 SET legal_name = ${newName},
                     country_code = ${countryCode},
                     metadata = ${JSON.stringify(meta)}::jsonb,
                     updated_at = now()
                 WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      } else {
        await tx`UPDATE clients
                 SET legal_name = ${newName},
                     metadata = ${JSON.stringify(meta)}::jsonb,
                     updated_at = now()
                 WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      }
      const rows = (await tx`SELECT * FROM clients WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as ClientRow[];
      const row = rows[0];
      if (!row) throw new NotFoundError('Clients', id);
      return rowToDto(row);
    });
  }

  async remove(firmId: string, id: string): Promise<void> {
    if (!this.hasRealDb()) return this.removeInMemory(firmId, id);
    return this.withTenant(async (tx) => {
      // Soft-delete: stamp archived_at so audit / ledger references stay
      // queryable. Hard DELETE is reserved for the data-retention worker.
      await tx`UPDATE clients
               SET archived_at = now(), updated_at = now()
               WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`;
      const rows = (await tx`SELECT id FROM clients WHERE id = ${id} AND firm_id = ${firmId}`) as unknown as { id: string }[];
      if (rows.length === 0) throw new NotFoundError('Clients', id);
    });
  }

  private async findByIdInTx(
    tx: postgres.TransactionSql,
    firmId: string,
    id: string,
  ): Promise<ClientsDto> {
    const rows = (await tx`SELECT * FROM clients WHERE id = ${id} AND firm_id = ${firmId} AND archived_at IS NULL`) as unknown as ClientRow[];
    const row = rows[0];
    if (!row) throw new NotFoundError('Clients', id);
    return rowToDto(row);
  }

  // ---------------------------------------------------------------------
  // Legacy in-memory implementation. Retained for unit tests that don't have
  // a Postgres available; selected automatically when the injected
  // postgres-js client is the test stub (no `.begin`).
  // ---------------------------------------------------------------------

  private async createInMemory(firmId: string, dto: CreateClientsDto): Promise<ClientsDto> {
    const now = new Date().toISOString();
    const row: ClientsDto = {
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
  private async findInMemory(firmId: string, id: string): Promise<ClientsDto> {
    const r = this.memory.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError('Clients', id);
    return r;
  }
  private async listInMemory(firmId: string, opts: { cursor?: string; limit: number }) {
    const all = Array.from(this.memory.values()).filter((r) => r.firmId === firmId);
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const next =
      startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor: next };
  }
  private async updateInMemory(
    firmId: string,
    id: string,
    dto: UpdateClientsDto,
  ): Promise<ClientsDto> {
    const cur = await this.findInMemory(firmId, id);
    // exactOptionalPropertyTypes: spread of `dto` would let `name: undefined`
    // overwrite the required `cur.name`; fall back to `cur.name` when absent.
    const updated: ClientsDto = {
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
