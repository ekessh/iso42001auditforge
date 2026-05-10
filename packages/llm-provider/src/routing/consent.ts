// SPDX-License-Identifier: BUSL-1.1
//
// Backwards-compatibility re-export. The canonical consent surface lives in
// @auditforge/consent-registry. This module retains the local
// `ConsentMissingError`, `AirGapViolation`, and ConsentGuard symbols used by
// existing tests / orchestrator wiring while delegating to the new package.

import {
  AirGapViolation as RegistryAirGapViolation,
  CloudConsentRequired,
  ConsentGuard as RegistryConsentGuard,
  type ConsentGuardConfig,
  type ConsentRecord as RegistryConsentRecord,
  type ConsentRegistry,
  InMemoryConsentRegistry,
} from '@auditforge/consent-registry';
import { ConsentMissingError } from '../errors.js';

export { CloudConsentRequired };

// WHY: legacy ConsentRecord shape used a single id+expiresAt+revoked tuple.
// We adapt it onto the richer ConsentRecord schema so existing test seeds
// continue to work without rewriting fixtures.
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

export interface LegacyConsentGuardConfig {
  airGap: boolean;
  consentRepo: ConsentRepository;
  now?: () => Date;
}

export class ConsentGuard {
  constructor(private readonly cfg: LegacyConsentGuardConfig) {}

  async assertCloudAllowed(opts: {
    providerName: string;
    isCloud: boolean;
    engagementId: string;
    consentRecordId?: string;
  }): Promise<void> {
    if (!opts.isCloud) return;
    if (this.cfg.airGap) {
      throw new RegistryAirGapViolation(opts.providerName);
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

// Bridge: make a guard against a registry-shaped repo (used by orchestrators
// that prefer the new schema directly).
export function fromRegistryGuard(
  config: ConsentGuardConfig,
): RegistryConsentGuard {
  return new RegistryConsentGuard(config);
}

export type {
  ConsentGuardConfig,
  ConsentRegistry,
  RegistryConsentRecord,
};
export { InMemoryConsentRegistry };
