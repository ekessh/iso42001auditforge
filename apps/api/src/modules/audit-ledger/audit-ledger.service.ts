// SPDX-License-Identifier: BUSL-1.1
import { Injectable } from '@nestjs/common';
import { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type { LedgerEventDto } from './dto.js';

@Injectable()
export class AuditLedgerService {
  constructor(private readonly engine: AuditEngineAdapter) {}

  async list(_firmId: string, _opts: { limit: number }): Promise<{ items: LedgerEventDto[]; nextCursor: string | null }> {
    // TODO(phase-1): query packages/audit-engine.list when available.
    return { items: [], nextCursor: null };
  }

  async verify(firmId: string): Promise<{ ok: boolean; head?: string; verifiedAt: string }> {
    const r = await this.engine.verifyChain(firmId);
    return { ...r, verifiedAt: new Date().toISOString() };
  }
}
