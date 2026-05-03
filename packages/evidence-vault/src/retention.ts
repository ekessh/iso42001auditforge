// SPDX-License-Identifier: BUSL-1.1
import type { ObjectStoreAdapter, LedgerEmitter } from './adapters.js';
import type { EvidenceObject } from './domain.js';

export interface RetentionDeps {
  store: ObjectStoreAdapter;
  ledger: LedgerEmitter;
  listExpired(now: Date): Promise<EvidenceObject[]>;
  markDeleted(id: string): Promise<void>;
}

export class RetentionEnforcer {
  constructor(private readonly d: RetentionDeps) {}

  async run(now = new Date()): Promise<{ deleted: number }> {
    const expired = await this.d.listExpired(now);
    let count = 0;
    for (const obj of expired) {
      await this.d.store.delete(obj.storageKey);
      await this.d.markDeleted(obj.id);
      await this.d.ledger.emit('evidence.retention_deleted', {
        evidenceId: obj.id, sha256: obj.sha256, retainUntil: obj.retainUntil, deletedAt: now.toISOString(),
      });
      count++;
    }
    return { deleted: count };
  }
}
