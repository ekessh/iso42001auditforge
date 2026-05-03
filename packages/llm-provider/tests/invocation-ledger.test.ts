// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  InMemoryInvocationLedgerSink,
  InvocationLedger,
} from '../src/index.js';
import { PT_VERSION, buildEngagement, buildOrchestratorHarness } from './fixtures.js';

const Schema = z.object({ answer: z.string() });

describe('InvocationLedger', () => {
  it('records every invocation with provider, model, tokens, latency', async () => {
    const sink = new InMemoryInvocationLedgerSink();
    const ledger = new InvocationLedger(sink);
    const r = await ledger.record({
      firmId: 'f',
      engagementId: 'e',
      task: 'claim_extraction',
      tier: 'small',
      provider: 'ollama',
      modelName: 'llama3.1:8b',
      promptTemplateVersion: 'v1',
      inputTokens: 10,
      outputTokens: 5,
      latencyMs: 100,
    });
    const all = await ledger.list({ engagementId: 'e' });
    expect(all.length).toBe(1);
    expect(all[0]?.id).toBe(r.id);
  });

  it('records auditor decisions on existing invocations', async () => {
    const sink = new InMemoryInvocationLedgerSink();
    const ledger = new InvocationLedger(sink);
    const r = await ledger.record({
      firmId: 'f',
      engagementId: 'e',
      task: 't',
      tier: 'small',
      provider: 'ollama',
      modelName: 'm',
      promptTemplateVersion: 'v1',
      inputTokens: 1,
      outputTokens: 1,
      latencyMs: 1,
    });
    await ledger.setDecision(r.id, 'accepted', 'auditor1', '2030-01-01T00:00:00.000Z');
    const all = await ledger.list();
    expect(all[0]?.decision).toBe('accepted');
    expect(all[0]?.decisionByAuditorId).toBe('auditor1');
  });

  it('orchestrator complete() records exactly one invocation', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    await h.orchestrator.complete('q', {
      task: 'claim_extraction',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
    });
    const list = await h.ledger.list({ engagementId: eng.engagementId });
    expect(list.length).toBe(1);
    expect(list[0]?.task).toBe('claim_extraction');
    expect(list[0]?.tier).toBe('small');
    expect(list[0]?.provider).toBe('ollama');
  });

  it('orchestrator classifyStructured() records invocation with classifyStructured metadata', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    h.consentRepo.put({
      id: 'c1',
      engagementId: eng.engagementId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    await h.orchestrator.classifyStructured('q', Schema, {
      task: 'attribution_rerank',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
      consentRecordId: 'c1',
    });
    const list = await h.ledger.list({ engagementId: eng.engagementId });
    expect(list.length).toBe(1);
    expect(list[0]?.metadata).toMatchObject({ mode: 'classifyStructured' });
  });

  it('orchestrator reasonStructured() records reasoning trace', async () => {
    const h = buildOrchestratorHarness();
    const eng = buildEngagement();
    h.consentRepo.put({
      id: 'c1',
      engagementId: eng.engagementId,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      revoked: false,
    });
    await h.orchestrator.reasonStructured('q', Schema, {
      task: 'reasoning_attribution',
      promptTemplateVersion: PT_VERSION,
      firmId: eng.firmId,
      engagementId: eng.engagementId,
      consentRecordId: 'c1',
      effortLevel: 'medium',
    });
    const list = await h.ledger.list({ engagementId: eng.engagementId });
    expect(list.length).toBe(1);
    expect(list[0]?.reasoningTrace).toBeTruthy();
  });

  it('orchestrator skips ledger when firmId/engagementId missing', async () => {
    const h = buildOrchestratorHarness();
    await h.orchestrator.complete('q', {
      task: 'claim_extraction',
      promptTemplateVersion: PT_VERSION,
    });
    const list = await h.ledger.list();
    expect(list.length).toBe(0);
  });
});
