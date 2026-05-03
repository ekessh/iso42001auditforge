// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { TierRouter, AirGapViolation, TierRouterError } from '../src/index.js';
import { buildAllProviders, buildTemplates } from './fixtures.js';

describe('TierRouter', () => {
  it('maps default tasks to expected tiers', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: false,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [{ provider: h.openai }],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    expect(router.resolveTier('claim_extraction')).toBe('small');
    expect(router.resolveTier('embedding')).toBe('small');
    expect(router.resolveTier('attribution_rerank')).toBe('medium');
    expect(router.resolveTier('contextualization')).toBe('medium');
    expect(router.resolveTier('nc_drafting')).toBe('medium');
    expect(router.resolveTier('synthesis')).toBe('large');
    expect(router.resolveTier('reasoning_attribution')).toBe('reasoning');
  });

  it('honors per-engagement overrides over the default mapping', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: false,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [{ provider: h.openai }],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
      perEngagementOverrides: {
        eng1: { claim_extraction: 'reasoning' },
      },
    });
    expect(router.resolveTier('claim_extraction', 'eng1')).toBe('reasoning');
    expect(router.resolveTier('claim_extraction', 'eng2')).toBe('small');
  });

  it('air-gap mode prevents routing to a cloud provider when no local fallback exists', () => {
    buildTemplates();
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: true,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [{ provider: h.openai }],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    expect(() => router.route('attribution_rerank')).toThrowError(AirGapViolation);
  });

  it('air-gap mode falls back to a local fallback when one is configured', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: true,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [
          { provider: h.openai },
          { provider: h.ollama, isFallback: true },
        ],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    const r = router.route('attribution_rerank');
    expect(r.provider.metadata().provider).toBe('ollama');
    expect(r.tier).toBe('medium');
  });

  it('throws TierRouterError when a tier has no providers', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: false,
      tierMap: {
        small: [],
        medium: [{ provider: h.openai }],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    expect(() => router.route('claim_extraction')).toThrowError(TierRouterError);
  });

  it('throws on unknown task with no mapping', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: false,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [{ provider: h.openai }],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    expect(() => router.resolveTier('telepathy')).toThrowError(TierRouterError);
  });

  it('preferLocal prefers a local fallback even outside air-gap mode', () => {
    const h = buildAllProviders();
    const router = new TierRouter({
      airGap: false,
      tierMap: {
        small: [{ provider: h.ollama }],
        medium: [
          { provider: h.openai },
          { provider: h.ollama, isFallback: true },
        ],
        large: [{ provider: h.openai }],
        reasoning: [{ provider: h.anthropic }],
      },
    });
    const r = router.route('nc_drafting', { preferLocal: true });
    expect(r.provider.metadata().provider).toBe('ollama');
  });
});
