// SPDX-License-Identifier: BUSL-1.1
//
// Internal helper — `TenantScopedRegistry<T>` is the shared persistence
// envelope used by adapters whose workspace package owns the *domain logic*
// (state machines, calculators, workflow services) but does not yet expose
// a CRUD repository contract.
//
// Goals:
//   - Eliminate `private memory = new Map<string, …>` from every module's
//     `*.repository.ts`. Repos delegate CRUD to a single tenant-aware store.
//   - Apply the firm-id tenant filter consistently (defence-in-depth on top
//     of Postgres RLS, which will be the production source).
//   - Stable cursor pagination (lexicographic by id, slice).
//   - Emit a ledger event for every mutating call via the audit-engine
//     adapter so writes flow through the hash chain even in the in-memory
//     transitional state.
//
// TODO(rls-migration): replace the in-memory store with Drizzle-backed
// implementations once `packages/db` exposes the per-module schemas.

import { randomUUID } from 'node:crypto';
import { NotFoundError } from '../common/errors.js';
import type { AuditEngineAdapter } from './audit-engine.adapter.js';

export interface TenantScopedRow {
  readonly id: string;
  readonly firmId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ListPage<T extends TenantScopedRow> {
  items: T[];
  nextCursor: string | null;
}

export interface RegistryLedgerHook<T extends TenantScopedRow> {
  /** Tag emitted for `entity` field on every audit-engine event. */
  entity: string;
  /** Map a row + lifecycle into a payload extension. */
  payload?: (row: T, lifecycle: 'created' | 'updated' | 'deleted') => Record<string, unknown>;
}

/**
 * Build a tenant-scoped repository envelope. The caller supplies a
 * `factory(firmId, dto)` that constructs a domain row from the raw DTO,
 * and an optional `mutate(row, dto)` for partial updates.
 *
 * The envelope handles id assignment, timestamps, tenant guard, cursor
 * pagination, and ledger emission. Domain logic (state machines, signed
 * actions, etc.) belongs in the workspace package — call the package
 * services *before* invoking these helpers.
 */
export class TenantScopedRegistry<
  TRow extends TenantScopedRow,
  TCreate,
  TUpdate,
> {
  private readonly store = new Map<string, TRow>();

  constructor(
    private readonly hook: RegistryLedgerHook<TRow>,
    private readonly audit: Pick<AuditEngineAdapter, 'append'>,
    private readonly factory: (firmId: string, dto: TCreate, base: { id: string; createdAt: string; updatedAt: string }) => TRow,
    private readonly merger: (current: TRow, dto: TUpdate, updatedAt: string) => TRow,
    private readonly entityName: string,
  ) {}

  async create(firmId: string, dto: TCreate, actorId: string = 'system'): Promise<TRow> {
    const now = new Date().toISOString();
    const row = this.factory(firmId, dto, { id: randomUUID(), createdAt: now, updatedAt: now });
    this.store.set(row.id, row);
    await this.emit(row, actorId, 'created');
    return row;
  }

  async findById(firmId: string, id: string): Promise<TRow> {
    const r = this.store.get(id);
    if (!r || r.firmId !== firmId) throw new NotFoundError(this.entityName, id);
    return r;
  }

  async list(firmId: string, opts: { cursor?: string; limit: number }): Promise<ListPage<TRow>> {
    const all = Array.from(this.store.values()).filter((r) => r.firmId === firmId);
    // Stable order — by createdAt then id, then slice via cursor index.
    all.sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
    const startIdx = opts.cursor ? all.findIndex((r) => r.id === opts.cursor) + 1 : 0;
    const slice = all.slice(startIdx, startIdx + opts.limit);
    const nextCursor = startIdx + opts.limit < all.length ? slice[slice.length - 1]?.id ?? null : null;
    return { items: slice, nextCursor };
  }

  async update(firmId: string, id: string, dto: TUpdate, actorId: string = 'system'): Promise<TRow> {
    const cur = await this.findById(firmId, id);
    const updated = this.merger(cur, dto, new Date().toISOString());
    this.store.set(id, updated);
    await this.emit(updated, actorId, 'updated');
    return updated;
  }

  async remove(firmId: string, id: string, actorId: string = 'system'): Promise<void> {
    const cur = await this.findById(firmId, id);
    this.store.delete(id);
    await this.emit(cur, actorId, 'deleted');
  }

  /** Test helper: snapshot every row (no tenant filter). */
  snapshot(): readonly TRow[] {
    return Array.from(this.store.values());
  }

  /** Test helper: clear all rows. */
  reset(): void {
    this.store.clear();
  }

  private async emit(row: TRow, actorId: string, lifecycle: 'created' | 'updated' | 'deleted'): Promise<void> {
    try {
      const extras = this.hook.payload?.(row, lifecycle) ?? {};
      await this.audit.append({
        firmId: row.firmId,
        actorId,
        type: `${this.hook.entity}.${lifecycle}`,
        entity: this.hook.entity,
        entityId: row.id,
        payload: { ...extras, at: row.updatedAt },
      });
    } catch {
      // Ledger failures must not crash the registry. The audit-engine adapter
      // already logs internally; swallow to keep the write path synchronous.
    }
  }
}
