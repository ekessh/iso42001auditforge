// SPDX-License-Identifier: BUSL-1.1
import { AirGapViolation, CloudConsentRequired } from './errors.js';
import type { ConsentRegistry } from './registry.js';

export interface ConsentGuardConfig {
  airGap: boolean;
  registry: ConsentRegistry;
  now?: () => Date;
}

export interface AssertCloudOpts {
  providerName: string;
  isCloud: boolean;
  engagementId: string;
}

export class ConsentGuard {
  constructor(private readonly cfg: ConsentGuardConfig) {}

  // WHY: air-gap is enforced BEFORE consent lookup so that a stale active
  // consent record cannot smuggle cloud traffic through a lab box that has
  // since been air-gapped (CLAUDE.md: "air-gap mode disables cloud at
  // provider layer").
  async assertCloudAllowed(opts: AssertCloudOpts): Promise<void> {
    if (!opts.isCloud) return;
    if (this.cfg.airGap) {
      throw new AirGapViolation(opts.providerName);
    }
    const now = (this.cfg.now ?? (() => new Date()))();
    const record = await this.cfg.registry.findActive({
      engagementId: opts.engagementId,
      providerName: opts.providerName,
      now,
    });
    if (!record) {
      throw new CloudConsentRequired(opts.engagementId, opts.providerName);
    }
  }

  static fromEnv(registry: ConsentRegistry, env: NodeJS.ProcessEnv = process.env): ConsentGuard {
    const airGap = env['AIR_GAP_MODE'] === '1' || env['AIR_GAP_MODE'] === 'true';
    return new ConsentGuard({ airGap, registry });
  }
}
