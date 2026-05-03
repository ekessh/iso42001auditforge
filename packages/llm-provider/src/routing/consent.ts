// SPDX-License-Identifier: BUSL-1.1
import { ConsentMissingError, AirGapViolation } from '../errors.js';

export interface ConsentRecord {
  id: string;
  engagementId: string;
  expiresAt: string;
  revoked: boolean;
}

export interface ConsentRepository {
  findActive(consentRecordId: string): Promise<ConsentRecord | null>;
}

export class InMemoryConsentRepository implements ConsentRepository {
  private readonly records = new Map<string, ConsentRecord>();

  put(record: ConsentRecord): void {
    this.records.set(record.id, { ...record });
  }

  remove(id: string): void {
    this.records.delete(id);
  }

  async findActive(consentRecordId: string): Promise<ConsentRecord | null> {
    const r = this.records.get(consentRecordId);
    if (!r) return null;
    if (r.revoked) return null;
    if (Date.parse(r.expiresAt) <= Date.now()) return null;
    return { ...r };
  }
}

export interface ConsentGuardConfig {
  airGap: boolean;
  consentRepo: ConsentRepository;
  now?: () => Date;
}

export class ConsentGuard {
  constructor(private readonly cfg: ConsentGuardConfig) {}

  async assertCloudAllowed(opts: {
    providerName: string;
    isCloud: boolean;
    engagementId: string;
    consentRecordId?: string;
  }): Promise<void> {
    if (!opts.isCloud) return;
    if (this.cfg.airGap) {
      throw new AirGapViolation(opts.providerName);
    }
    if (!opts.consentRecordId) {
      throw new ConsentMissingError(opts.engagementId);
    }
    const r = await this.cfg.consentRepo.findActive(opts.consentRecordId);
    if (!r || r.engagementId !== opts.engagementId) {
      throw new ConsentMissingError(opts.engagementId);
    }
  }
}
