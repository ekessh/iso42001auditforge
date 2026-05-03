// SPDX-License-Identifier: BUSL-1.1

export interface LlmBackend {
  generate(opts: { systemPrompt: string; userPrompt: string; model?: string; temperature?: number; maxTokens?: number }): Promise<{ output: string; tokensUsed: number; costUsd: number }>;
}

export interface ConsentLookup {
  isActive(consentRecordId: string, engagementId: string): Promise<boolean>;
}

export class LlmBackendRouter {
  constructor(
    private readonly local: LlmBackend,
    private readonly cloud: LlmBackend,
    private readonly consent: ConsentLookup,
  ) {}

  async route(opts: {
    backend: 'local' | 'cloud';
    engagementId: string;
    consentRecordId: string | null;
    systemPrompt: string;
    userPrompt: string;
    model?: string;
  }): Promise<{ output: string; tokensUsed: number; costUsd: number }> {
    if (opts.backend === 'cloud') {
      if (!opts.consentRecordId) throw new Error('cloud LLM requires consentRecordId');
      const active = await this.consent.isActive(opts.consentRecordId, opts.engagementId);
      if (!active) throw new Error('cloud LLM consent inactive or expired');
      return this.cloud.generate(opts);
    }
    return this.local.generate(opts);
  }
}
