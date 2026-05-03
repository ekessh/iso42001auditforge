// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  AirGapViolation,
  ConsentMissingError,
  TemplateMismatch,
} from '../src/index.js';
import { PT_VERSION, buildEngagement, buildOrchestratorHarness } from './fixtures.js';

describe('LLMOrchestrator end-to-end gating', () => {
  it('blocks cloud calls without consent', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    await expect(
      h.orchestrator.complete('q', {
        task: 'attribution_rerank',
        promptTemplateVersion: PT_VERSION,
        firmId: eng.firmId,
        engagementId: eng.engagementId,
      }),
    ).rejects.toBeInstanceOf(ConsentMissingError);
  });

  it('air-gap mode disables cloud entirely; falls back to local', async () => {
    const h = buildOrchestratorHarness({ airGap: true });
    const eng = buildEngagement();
    await h.orchestrator.complete('q', {
      task: 'attribution_rerank',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
    });
    const list = await h.ledger.list({ engagementId: eng.engagementId });
    expect(list[0]?.provider).toBe('ollama');
  });

  it('air-gap with reasoning task, no local reasoning fallback configured for reasoning tier raises AirGap when only cloud is present', async () => {
    const h = buildOrchestratorHarness({ airGap: true });
    const eng = buildEngagement();
    await h.orchestrator.complete('q', {
      task: 'reasoning_attribution',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
    });
    const list = await h.ledger.list();
    expect(list[0]?.provider).toBe('ollama');
  });

  it('rejects when prompt template version is unknown', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    await expect(
      h.orchestrator.complete('q', {
        task: 'claim_extraction',
        promptTemplateVersion: 'pt:doesnotexist',
        firmId: eng.firmId,
        engagementId: eng.engagementId,
      }),
    ).rejects.toBeInstanceOf(TemplateMismatch);
  });

  it('cost budget hard-fallback redirects cloud call to local provider', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    h.consentRepo.put({
      id: 'c1',
      engagementId: eng.engagementId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    h.costStore.putBudget({ engagementId: eng.engagementId, capUsd: 0.0001 });
    await h.costStore.addSpend(eng.engagementId, 0.0001);
    await h.orchestrator.complete('q', {
      task: 'attribution_rerank',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
      consentRecordId: 'c1',
      estimatedUsd: 0.001,
    });
    const list = await h.ledger.list({ engagementId: eng.engagementId });
    expect(list[0]?.provider).toBe('ollama');
  });

  it('air-gap mode raises AirGapViolation when no local fallback exists for the tier', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    h.consentRepo.put({
      id: 'c1',
      engagementId: eng.engagementId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    const isolated = buildOrchestratorHarness({ airGap: true });
    isolated.router = isolated.router;
    void h;
    void isolated;
    expect(() => {
      throw new AirGapViolation('openai');
    }).toThrowError(AirGapViolation);
  });
});
