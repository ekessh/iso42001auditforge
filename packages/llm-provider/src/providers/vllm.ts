// SPDX-License-Identifier: BUSL-1.1
import { ProviderHttpError } from '../errors.js';
import type {
  CompletionOpts,
  CompletionResult,
  ProviderCapabilities,
  ProviderMetadata,
} from '../types.js';
import type { PromptTemplateRegistry } from '../templates/registry.js';
import { BaseProvider } from './base.js';
import { defaultFetch, type HttpFetch } from './http.js';

export interface VllmConfig {
  baseUrl: string;
  defaultModel: string;
  embeddingModel?: string;
  apiKey?: string;
  contextWindow?: number;
  templates: PromptTemplateRegistry;
  fetchImpl?: HttpFetch;
}

export class VllmProvider extends BaseProvider {
  private readonly fetchImpl: HttpFetch;

  constructor(private readonly cfg: VllmConfig) {
    super({ templates: cfg.templates });
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch;
  }

  isCloud(): boolean {
    return false;
  }

  capabilities(): ProviderCapabilities {
    return { supportsReasoning: true, supportsEmbedding: true, supportsGrammar: false };
  }

  metadata(): ProviderMetadata {
    return {
      provider: 'vllm',
      modelName: this.cfg.defaultModel,
      contextWindow: this.cfg.contextWindow ?? 8192,
    };
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.apiKey) h.Authorization = `Bearer ${this.cfg.apiKey}`;
    return h;
  }

  async complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    const start = Date.now();
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/v1/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model,
        prompt,
        temperature: opts.temperature ?? 0.0,
        max_tokens: opts.maxTokens ?? 2048,
      }),
    });
    if (r.status >= 400) {
      throw new ProviderHttpError('vllm', r.status, await r.text());
    }
    const body = (await r.json()) as {
      choices: { text: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };
    const latencyMs = Date.now() - start;
    return {
      output: body.choices[0]?.text ?? '',
      tokensUsed: {
        input: body.usage?.prompt_tokens ?? 0,
        output: body.usage?.completion_tokens ?? 0,
      },
      latencyMs,
      modelMetadata: {
        provider: 'vllm',
        modelName: body.model ?? model,
        contextWindow: this.cfg.contextWindow ?? 8192,
      },
    };
  }

  async embed(input: string | string[], opts?: { model?: string }): Promise<number[][]> {
    const model = opts?.model ?? this.cfg.embeddingModel ?? this.cfg.defaultModel;
    const inputs = Array.isArray(input) ? input : [input];
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/v1/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model, input: inputs }),
    });
    if (r.status >= 400) {
      throw new ProviderHttpError('vllm', r.status, await r.text());
    }
    const body = (await r.json()) as { data: { embedding: number[] }[] };
    return body.data.map((d) => d.embedding);
  }
}
