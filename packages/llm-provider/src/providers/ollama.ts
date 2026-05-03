// SPDX-License-Identifier: BUSL-1.1
import { ProviderHttpError, StructuredParseError } from '../errors.js';
import type {
  CompletionOpts,
  CompletionResult,
  ProviderCapabilities,
  ProviderMetadata,
  ReasoningResult,
} from '../types.js';
import type { ZodSchema } from 'zod';
import type { PromptTemplateRegistry } from '../templates/registry.js';
import { BaseProvider } from './base.js';
import { defaultFetch, type HttpFetch } from './http.js';

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  embeddingModel?: string;
  contextWindow?: number;
  templates: PromptTemplateRegistry;
  fetchImpl?: HttpFetch;
  costPerKToken?: { input: number; output: number };
}

export class OllamaProvider extends BaseProvider {
  private readonly fetchImpl: HttpFetch;

  constructor(private readonly cfg: OllamaConfig) {
    super({ templates: cfg.templates });
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch;
  }

  isCloud(): boolean {
    return false;
  }

  capabilities(): ProviderCapabilities {
    return {
      supportsReasoning: true,
      supportsEmbedding: true,
      supportsGrammar: true,
    };
  }

  metadata(): ProviderMetadata {
    return {
      provider: 'ollama',
      modelName: this.cfg.defaultModel,
      contextWindow: this.cfg.contextWindow ?? 8192,
    };
  }

  async modelHash(model: string = this.cfg.defaultModel): Promise<string | null> {
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (r.status >= 400) return null;
    const body = (await r.json()) as { digest?: string };
    return body.digest ?? null;
  }

  async complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    const start = Date.now();
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.0,
          num_predict: opts.maxTokens ?? 2048,
        },
      }),
    });
    if (r.status >= 400) {
      throw new ProviderHttpError('ollama', r.status, await r.text());
    }
    const body = (await r.json()) as {
      response: string;
      prompt_eval_count?: number;
      eval_count?: number;
      digest?: string;
    };
    const latencyMs = Date.now() - start;
    const inputTokens = body.prompt_eval_count ?? 0;
    const outputTokens = body.eval_count ?? 0;
    const cost = this.cfg.costPerKToken
      ? (inputTokens / 1000) * this.cfg.costPerKToken.input +
        (outputTokens / 1000) * this.cfg.costPerKToken.output
      : 0;
    const meta: CompletionResult['modelMetadata'] = {
      provider: 'ollama',
      modelName: model,
      contextWindow: this.cfg.contextWindow ?? 8192,
    };
    if (body.digest !== undefined) meta.modelHash = body.digest;
    return {
      output: body.response,
      tokensUsed: { input: inputTokens, output: outputTokens },
      latencyMs,
      costUsd: cost,
      modelMetadata: meta,
    };
  }

  async embed(input: string | string[], opts?: { model?: string }): Promise<number[][]> {
    const model = opts?.model ?? this.cfg.embeddingModel ?? this.cfg.defaultModel;
    const inputs = Array.isArray(input) ? input : [input];
    const out: number[][] = [];
    for (const txt of inputs) {
      const r = await this.fetchImpl(`${this.cfg.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: txt }),
      });
      if (r.status >= 400) {
        throw new ProviderHttpError('ollama', r.status, await r.text());
      }
      const body = (await r.json()) as { embedding?: number[] };
      out.push(body.embedding ?? []);
    }
    return out;
  }

  override async classifyStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts,
  ): Promise<T> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    let lastError = '';
    for (let i = 0; i < 3; i++) {
      const r = await this.fetchImpl(`${this.cfg.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          format: 'json',
          stream: false,
          options: {
            temperature: opts.temperature ?? 0.0,
            num_predict: opts.maxTokens ?? 1024,
          },
        }),
      });
      if (r.status >= 400) {
        throw new ProviderHttpError('ollama', r.status, await r.text());
      }
      const body = (await r.json()) as { response: string };
      try {
        const parsed = schema.safeParse(JSON.parse(body.response));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.issues.map((i) => i.message).join('|');
      } catch (e) {
        lastError = `parse:${e instanceof Error ? e.message : String(e)}`;
      }
    }
    throw new StructuredParseError('ollama', 3, lastError);
  }

  override async reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>> {
    return super.reasonStructured(prompt, schema, opts);
  }
}
