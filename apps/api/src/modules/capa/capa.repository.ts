// SPDX-License-Identifier: BUSL-1.1
//
// CapaRepository — delegates to `CapaAdapter`'s tenant-scoped registry.
// Map stub eliminated; mutations emit hash-chained ledger events.
//
// TODO(rls-migration): swap the registry's in-memory store for Drizzle once
// `packages/db` exposes `corrective_actions` + companion tables.

import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../db/base.repository.js';
import type { CapaDto, CreateCapaDto, UpdateCapaDto } from './dto.js';
import { CapaAdapter } from '../../adapters/capa.adapter.js';

@Injectable()
export class CapaRepository extends BaseRepository {
  private adapter: CapaAdapter | null;

  constructor(...args: unknown[]) {
    super(args[0] as never, args[1] as never);
    this.adapter = (args[2] as CapaAdapter | undefined) ?? null;
  }

  private async ensureAdapter(): Promise<CapaAdapter> {
    if (this.adapter) return this.adapter;
    const { AuditEngineAdapter } = await import('../../adapters/audit-engine.adapter.js');
    const { CapaAdapter } = await import('../../adapters/capa.adapter.js');
    this.adapter = new CapaAdapter(new AuditEngineAdapter());
    return this.adapter;
  }

  async create(firmId: string, dto: CreateCapaDto): Promise<CapaDto> {
    return (await this.ensureAdapter()).registry.create(firmId, dto);
  }
  async findById(firmId: string, id: string): Promise<CapaDto> {
    return (await this.ensureAdapter()).registry.findById(firmId, id);
  }
  async list(
    firmId: string,
    opts: { cursor?: string; limit: number },
  ): Promise<{ items: CapaDto[]; nextCursor: string | null }> {
    return (await this.ensureAdapter()).registry.list(firmId, opts);
  }
  async update(firmId: string, id: string, dto: UpdateCapaDto): Promise<CapaDto> {
    return (await this.ensureAdapter()).registry.update(firmId, id, dto);
  }
  async remove(firmId: string, id: string): Promise<void> {
    return (await this.ensureAdapter()).registry.remove(firmId, id);
  }
}
