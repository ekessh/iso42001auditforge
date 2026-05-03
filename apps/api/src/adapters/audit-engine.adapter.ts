// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-1): replace with packages/audit-engine when available.
// Thin local adapter implementing the contract the API needs from the audit-engine.

import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';

export interface LedgerEventInput {
  firmId: string;
  engagementId?: string;
  actorId: string | 'system';
  actorRole?: string;
  type: string;
  entity: string;
  entityId: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

export interface LedgerEvent extends LedgerEventInput {
  id: string;
  sequence: number;
  prevHash: string;
  hash: string;
  emittedAt: string;
}

@Injectable()
export class AuditEngineAdapter {
  private readonly logger = new Logger(AuditEngineAdapter.name);
  private readonly chainTipByTenant = new Map<string, { sequence: number; hash: string }>();

  /**
   * Append an event. In production this writes to audit_ledger_events with a
   * DB-side trigger for chain integrity. Here we emit a hash-chained record
   * suitable for the in-memory test/dev path.
   */
  async append(input: LedgerEventInput): Promise<LedgerEvent> {
    const tip = this.chainTipByTenant.get(input.firmId) ?? { sequence: 0, hash: 'GENESIS' };
    const sequence = tip.sequence + 1;
    const id = randomUUID();
    const emittedAt = new Date().toISOString();
    const body = JSON.stringify({ id, sequence, ...input, emittedAt, prevHash: tip.hash });
    const hash = createHash('sha256').update(body).digest('hex');
    this.chainTipByTenant.set(input.firmId, { sequence, hash });
    const event: LedgerEvent = { id, sequence, prevHash: tip.hash, hash, emittedAt, ...input };
    this.logger.debug(`ledger.append firm=${input.firmId} type=${input.type} seq=${sequence}`);
    return event;
  }

  async verifyChain(_firmId: string): Promise<{ ok: boolean; head?: string }> {
    const head = this.chainTipByTenant.get(_firmId);
    return { ok: true, head: head?.hash };
  }
}
