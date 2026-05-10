// SPDX-License-Identifier: BUSL-1.1
import type { ConsentRecord, ConsentLookup } from './types.js';

export interface ConsentRegistry {
  findActive(lookup: ConsentLookup): Promise<ConsentRecord | null>;
  list(engagementId: string): Promise<readonly ConsentRecord[]>;
}

export class InMemoryConsentRegistry implements ConsentRegistry {
  private readonly records = new Map<string, ConsentRecord>();

  put(record: ConsentRecord): void {
    this.records.set(record.id, { ...record });
  }

  remove(id: string): void {
    this.records.delete(id);
  }

  async list(engagementId: string): Promise<readonly ConsentRecord[]> {
    return [...this.records.values()].filter((r) => r.engagementId === engagementId);
  }

  async findActive(lookup: ConsentLookup): Promise<ConsentRecord | null> {
    const now = lookup.now ?? new Date();
    const nowMs = now.getTime();
    const candidates = [...this.records.values()].filter((r) => {
      if (r.engagementId !== lookup.engagementId) return false;
      if (!r.providers.includes(lookup.providerName)) return false;
      if (r.revokedAt) return false;
      const grantedMs = Date.parse(r.grantedAt);
      if (Number.isFinite(grantedMs) && grantedMs > nowMs) return false;
      if (r.expiresAt) {
        const exp = Date.parse(r.expiresAt);
        if (Number.isFinite(exp) && exp <= nowMs) return false;
      }
      return true;
    });
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => Date.parse(b.grantedAt) - Date.parse(a.grantedAt));
    const winner = candidates[0]!;
    return { ...winner };
  }
}
