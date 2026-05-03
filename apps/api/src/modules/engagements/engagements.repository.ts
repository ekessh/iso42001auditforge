// SPDX-License-Identifier: BUSL-1.1
//
// EngagementsRepository — thin shim over `EngagementAdapter`'s
// tenant-scoped registry. The Map-backed stub previously inlined here is
// gone; CRUD now flows through the adapter, and every mutation emits a
// hash-chained ledger event via the audit-engine adapter.
//
// The repository keeps the same public surface (`create`, `findById`,
// `list`, `update`, `setStatus`) so the controller / service contracts
// are preserved.
//
// TODO(rls-migration): once `packages/db` exposes the `engagements` table,
// the registry's in-memory store is swapped for a Drizzle-backed
// implementation behind the same `TenantScopedRegistry` API.

import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { CreateEngagementDto, EngagementDto, UpdateEngagementDto } from './dto.js';
import { EngagementAdapter } from '../../adapters/engagement.adapter.js';

@Injectable()
export class EngagementsRepository extends BaseRepository {
  // Allow the constructor signature to remain `(sql, tenancy)` for the
  // legacy call sites (notably `engagements.service.spec.ts` which
  // constructs `new EngagementsRepository({} as never, new TenancyAdapter())`).
  // The adapter is supplied lazily through the optional 3rd argument.
  private adapter: EngagementAdapter | null;

  constructor(...args: unknown[]) {
    // BaseRepository requires (sql, tenancy). Nest will inject the right
    // shape; tests pass `({} as never, tenancy)`.
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as EngagementAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<EngagementAdapter> {
    if (this.adapter) return this.adapter;
    // Fallback for unit tests that only pass (sql, tenancy): build an
    // adapter on demand wired to a fresh in-memory audit-engine adapter,
    // and memoise it so subsequent calls share the same in-memory store.
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { EngagementAdapter } = await import('../../adapters/engagement.adapter.js');
    this.adapter = new EngagementAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateEngagementDto): Promise<EngagementDto> {
    const adapter = await this.ensureAdapter();
    return adapter.registry.create(firmId, dto);
  }

  async findById(firmId: string, id: string): Promise<EngagementDto> {
    const adapter = await this.ensureAdapter();
    return adapter.registry.findById(firmId, id);
  }

  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: EngagementDto[]; nextCursor: string | null }> {
    const adapter = await this.ensureAdapter();
    return adapter.registry.list(firmId, opts);
  }

  async update(firmId: string, id: string, dto: UpdateEngagementDto): Promise<EngagementDto> {
    const adapter = await this.ensureAdapter();
    return adapter.updateEngagement(firmId, id, dto);
  }

  async setStatus(
    firmId: string,
    id: string,
    status: EngagementDto['status'],
  ): Promise<EngagementDto> {
    const adapter = await this.ensureAdapter();
    // setStatus is a privileged transition — bypasses mode-immutability
    // check (status is not mode). We update via the registry's merger.
    return adapter.registry.update(firmId, id, { status } as never);
  }
}
