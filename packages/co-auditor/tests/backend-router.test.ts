// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { LlmBackendRouter } from '../src/backend-router.js';

const local = { generate: vi.fn().mockResolvedValue({ output: '{}', tokensUsed: 1, costUsd: 0 }) };
const cloud = { generate: vi.fn().mockResolvedValue({ output: '{}', tokensUsed: 1, costUsd: 0.01 }) };

describe('LlmBackendRouter', () => {
  it('routes to local by default without consent', async () => {
    const r = new LlmBackendRouter(local, cloud, { isActive: async () => true });
    await r.route({ backend: 'local', engagementId: 'e1', consentRecordId: null, systemPrompt: 's', userPrompt: 'u' });
    expect(local.generate).toHaveBeenCalled();
  });
  it('rejects cloud without consent', async () => {
    const r = new LlmBackendRouter(local, cloud, { isActive: async () => true });
    await expect(r.route({ backend: 'cloud', engagementId: 'e1', consentRecordId: null, systemPrompt: 's', userPrompt: 'u' }))
      .rejects.toThrow(/consentRecordId/);
  });
  it('rejects cloud with inactive consent', async () => {
    const r = new LlmBackendRouter(local, cloud, { isActive: async () => false });
    await expect(r.route({ backend: 'cloud', engagementId: 'e1', consentRecordId: 'c1', systemPrompt: 's', userPrompt: 'u' }))
      .rejects.toThrow(/inactive|expired/);
  });
  it('allows cloud with active consent', async () => {
    const r = new LlmBackendRouter(local, cloud, { isActive: async () => true });
    await r.route({ backend: 'cloud', engagementId: 'e1', consentRecordId: 'c1', systemPrompt: 's', userPrompt: 'u' });
    expect(cloud.generate).toHaveBeenCalled();
  });
});
