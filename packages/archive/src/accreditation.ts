// SPDX-License-Identifier: BUSL-1.1
import type { AccessGrant } from './domain.js';

export interface AccessGrantRepo {
  insert(grant: AccessGrant): Promise<void>;
  load(id: string): Promise<AccessGrant | null>;
  markConsumed(id: string, when: string): Promise<void>;
}

export interface AccreditationLedger {
  emit(eventType: string, payload: unknown): Promise<{ eventId: string }>;
}

export class AccreditationPortalService {
  constructor(private readonly repo: AccessGrantRepo, private readonly ledger: AccreditationLedger) {}

  async issue(grant: AccessGrant): Promise<void> {
    if (grant.granteeRole !== 'accreditation_auditor') throw new Error('role must be accreditation_auditor');
    if (new Date(grant.expiresAt).getTime() <= new Date(grant.issuedAt).getTime()) throw new Error('expiresAt must be after issuedAt');
    await this.repo.insert(grant);
    await this.ledger.emit('accreditation.access_granted', {
      grantId: grant.id, archiveId: grant.archiveId, scope: grant.scope, expiresAt: grant.expiresAt,
    });
  }

  async authorize(grantId: string, scope: AccessGrant['scope'][number]): Promise<AccessGrant> {
    const grant = await this.repo.load(grantId);
    if (!grant) throw new Error('grant not found');
    if (new Date(grant.expiresAt).getTime() < Date.now()) throw new Error('grant expired');
    if (!grant.scope.includes(scope)) throw new Error(`scope "${scope}" not granted`);
    await this.ledger.emit('accreditation.access_used', { grantId, scope, at: new Date().toISOString() });
    return grant;
  }
}
