// SPDX-License-Identifier: BUSL-1.1
import { TierRouterError, AirGapViolation } from '../errors.js';
import type { LLMProvider } from '../types.js';
import type { LlmTier } from './invocation-ledger.js';

export type TaskName =
  | 'claim_extraction'
  | 'embedding'
  | 'attribution_rerank'
  | 'contextualization'
  | 'nc_drafting'
  | 'synthesis'
  | 'reasoning_attribution'
  | (string & { __taskBrand?: never });

export const DEFAULT_TASK_TIER_MAP: Record<string, LlmTier> = {
  claim_extraction: 'small',
  embedding: 'small',
  attribution_rerank: 'medium',
  contextualization: 'medium',
  nc_drafting: 'medium',
  synthesis: 'large',
  reasoning_attribution: 'reasoning',
};

export interface TierProviderEntry {
  provider: LLMProvider;
  isFallback?: boolean;
}

export interface TierRouterConfig {
  airGap: boolean;
  tierMap: Record<LlmTier, TierProviderEntry[]>;
  taskTierMap?: Partial<Record<string, LlmTier>>;
  perEngagementOverrides?: Record<string, Partial<Record<string, LlmTier>>>;
}

export class TierRouter {
  constructor(private readonly cfg: TierRouterConfig) {}

  resolveTier(task: TaskName, engagementId?: string): LlmTier {
    if (engagementId && this.cfg.perEngagementOverrides?.[engagementId]?.[task]) {
      return this.cfg.perEngagementOverrides[engagementId]![task]!;
    }
    if (this.cfg.taskTierMap?.[task]) return this.cfg.taskTierMap[task]!;
    if (DEFAULT_TASK_TIER_MAP[task]) return DEFAULT_TASK_TIER_MAP[task]!;
    throw new TierRouterError(`no tier mapping for task ${task}`);
  }

  route(task: TaskName, opts: { engagementId?: string; preferLocal?: boolean } = {}): {
    provider: LLMProvider;
    tier: LlmTier;
  } {
    const tier = this.resolveTier(task, opts.engagementId);
    const candidates = this.cfg.tierMap[tier];
    if (!candidates || candidates.length === 0) {
      throw new TierRouterError(`no providers configured for tier ${tier}`);
    }
    let usable = candidates;
    if (this.cfg.airGap || opts.preferLocal) {
      usable = candidates.filter((c) => !c.provider.isCloud());
    }
    if (usable.length === 0) {
      const cloudOnly = candidates[0];
      if (cloudOnly && this.cfg.airGap) {
        throw new AirGapViolation(cloudOnly.provider.metadata().provider);
      }
      throw new TierRouterError(`no usable providers for tier ${tier}`);
    }
    const primary = usable.find((c) => !c.isFallback) ?? usable[0]!;
    return { provider: primary.provider, tier };
  }

  fallbackLocal(tier: LlmTier): LLMProvider | null {
    const candidates = this.cfg.tierMap[tier] ?? [];
    const local = candidates.find((c) => !c.provider.isCloud());
    return local ? local.provider : null;
  }
}
