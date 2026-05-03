// SPDX-License-Identifier: BUSL-1.1
import type { AuditFileArchive, TsaToken } from './domain.js';

export interface LtvDeps {
  loadAll(): Promise<AuditFileArchive[]>;
  saveTsa(archiveId: string, token: TsaToken): Promise<void>;
  stampTsa(merkleRoot: string): Promise<TsaToken>;
  ledgerEmit(eventType: string, payload: unknown): Promise<{ eventId: string }>;
}

export class LtvRenewalJob {
  constructor(private readonly d: LtvDeps, private readonly renewBeforeDays = 365) {}

  async run(now = new Date()): Promise<{ renewed: number }> {
    const archives = await this.d.loadAll();
    let count = 0;
    for (const a of archives) {
      const lastTsa = a.tsaTokens[a.tsaTokens.length - 1]!;
      const ageMs = now.getTime() - new Date(lastTsa.issuedAt).getTime();
      if (ageMs / (1000 * 3600 * 24) < this.renewBeforeDays) continue;
      const token = await this.d.stampTsa(a.merkleRoot);
      await this.d.saveTsa(a.id, token);
      await this.d.ledgerEmit('archive.ltv_renewed', { archiveId: a.id, authority: token.authority });
      count++;
    }
    return { renewed: count };
  }
}
