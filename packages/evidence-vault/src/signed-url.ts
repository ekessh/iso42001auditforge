// SPDX-License-Identifier: BUSL-1.1
import type { ObjectStoreAdapter, LedgerEmitter } from './adapters.js';
import type { SignedUrlGrant } from './domain.js';

export interface SignedUrlIssuerDeps {
  store: ObjectStoreAdapter;
  ledger: LedgerEmitter;
  saveGrant(grant: SignedUrlGrant): Promise<void>;
  loadGrant(id: string): Promise<SignedUrlGrant | null>;
  markConsumed(id: string): Promise<void>;
}

export class SignedUrlIssuer {
  constructor(private readonly d: SignedUrlIssuerDeps) {}

  async issue(grant: SignedUrlGrant, storageKey: string, ttlSeconds: number): Promise<{ grantId: string; url: string }> {
    if (grant.consumed) throw new Error('grant already consumed');
    const now = Date.now();
    const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
    const finalGrant = { ...grant, expiresAt };
    await this.d.saveGrant(finalGrant);
    const url = await this.d.store.presignGet(storageKey, { ttlSeconds });
    await this.d.ledger.emit('evidence.signed_url_issued', {
      grantId: grant.id, evidenceId: grant.evidenceId, scope: grant.scope, expiresAt,
    });
    return { grantId: grant.id, url };
  }

  async consume(grantId: string): Promise<void> {
    const grant = await this.d.loadGrant(grantId);
    if (!grant) throw new Error('grant not found');
    if (grant.consumed) throw new Error('grant already consumed');
    if (new Date(grant.expiresAt).getTime() < Date.now()) throw new Error('grant expired');
    if (grant.singleUse) await this.d.markConsumed(grantId);
  }
}
