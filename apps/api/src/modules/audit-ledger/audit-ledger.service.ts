// SPDX-License-Identifier: BUSL-1.1
//
// Audit-ledger service — exposes the firm-scoped event stream + chain
// verification endpoint. Both delegate to the `AuditEngineAdapter` which
// itself wraps `@auditforge/audit-engine`'s `AuditLedger`.

import { Injectable } from '@nestjs/common';
import type { AuditEngineAdapter } from '../../adapters/audit-engine.adapter.js';
import type { LedgerEventDto } from './dto.js';

@Injectable()
export class AuditLedgerService {
  constructor(private readonly engine: AuditEngineAdapter) {}

  async list(
    firmId: string,
    opts: { limit: number; fromSeq?: number; toSeq?: number },
  ): Promise<{ items: LedgerEventDto[]; nextCursor: string | null }> {
    const events = await this.engine.list({
      firmId,
      ...(opts.fromSeq !== undefined ? { fromSequence: opts.fromSeq } : {}),
      ...(opts.toSeq !== undefined ? { toSequence: opts.toSeq } : {}),
    });
    const items: LedgerEventDto[] = events.slice(0, opts.limit).map((e) => ({
      id: e.id,
      sequence: e.sequence,
      firmId: e.firmId,
      ...(e.engagementId !== undefined ? { engagementId: e.engagementId } : {}),
      actorId: e.actorId,
      ...(e.actorRole !== undefined ? { actorRole: e.actorRole } : {}),
      type: e.type,
      entity: e.entity,
      entityId: e.entityId,
      payload: e.payload,
      prevHash: e.prevHash,
      hash: e.hash,
      emittedAt: e.emittedAt,
    }));
    const nextCursor =
      events.length > opts.limit ? items[items.length - 1]?.id ?? null : null;
    return { items, nextCursor };
  }

  /**
   * Verify the firm's chain. Walks every event through the package's
   * verifier; returns the chain head hash on success or the first invalid
   * sequence number on failure.
   */
  async verify(
    firmId: string,
  ): Promise<{
    ok: boolean;
    head?: string;
    verifiedAt: string;
    reason?: string;
    firstInvalidSequence?: number;
  }> {
    const r = await this.engine.verifyChain(firmId);
    return { ...r, verifiedAt: new Date().toISOString() };
  }
}
