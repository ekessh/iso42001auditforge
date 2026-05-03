// SPDX-License-Identifier: BUSL-1.1
import { ProviderHttpError, StructuredParseError } from '../errors.js';
import type {
  CompletionOpts,
  CompletionResult,
  ProviderCapabilities,
  ProviderMetadata,
} from '../types.js';
import type { ZodSchema, ZodTypeAny } from 'zod';
import type { PromptTemplateRegistry } from '../templates/registry.js';
import { BaseProvider } from './base.js';
import { defaultFetch, type HttpFetch } from './http.js';

export interface LlamaCppConfig {
  baseUrl: string;
  defaultModel: string;
  contextWindow?: number;
  templates: PromptTemplateRegistry;
  fetchImpl?: HttpFetch;
}

export class LlamaCppProvider extends BaseProvider {
  private readonly fetchImpl: HttpFetch;

  constructor(private readonly cfg: LlamaCppConfig) {
    super({ templates: cfg.templates });
    this.fetchImpl = cfg.fetchImpl ?? defaultFetch;
  }

  isCloud(): boolean {
    return false;
  }

  capabilities(): ProviderCapabilities {
    return { supportsReasoning: true, supportsEmbedding: true, supportsGrammar: true };
  }

  metadata(): ProviderMetadata {
    return {
      provider: 'llamacpp',
      modelName: this.cfg.defaultModel,
      contextWindow: this.cfg.contextWindow ?? 8192,
    };
  }

  async complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const start = Date.now();
    const r = await this.fetchImpl(`${this.cfg.baseUrl}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        temperature: opts.temperature ?? 0.0,
        n_predict: opts.maxTokens ?? 2048,
        stream: false,
      }),
    });
    if (r.status >= 400) {
      throw new ProviderHttpError('llamacpp', r.status, await r.text());
    }
    const body = (await r.json()) as {
      content: string;
      tokens_evaluated?: number;
      tokens_predicted?: number;
    };
    return {
      output: body.content,
      tokensUsed: {
        input: body.tokens_evaluated ?? 0,
        output: body.tokens_predicted ?? 0,
      },
      latencyMs: Date.now() - start,
      modelMetadata: {
        provider: 'llamacpp',
        modelName: opts.model ?? this.cfg.defaultModel,
        contextWindow: this.cfg.contextWindow ?? 8192,
      },
    };
  }

  async embed(input: string | string[], _opts?: { model?: string }): Promise<number[][]> {
    const inputs = Array.isArray(input) ? input : [input];
    const out: number[][] = [];
    for (const txt of inputs) {
      const r = await this.fetchImpl(`${this.cfg.baseUrl}/embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: txt }),
      });
      if (r.status >= 400) {
        throw new ProviderHttpError('llamacpp', r.status, await r.text());
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
    const grammar = zodToGrammar(schema);
    let lastError = '';
    for (let i = 0; i < 3; i++) {
      const r = await this.fetchImpl(`${this.cfg.baseUrl}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          temperature: opts.temperature ?? 0.0,
          n_predict: opts.maxTokens ?? 1024,
          grammar,
          stream: false,
        }),
      });
      if (r.status >= 400) {
        throw new ProviderHttpError('llamacpp', r.status, await r.text());
      }
      const body = (await r.json()) as { content: string };
      try {
        const parsed = schema.safeParse(JSON.parse(body.content));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.issues.map((i) => i.message).join('|');
      } catch (e) {
        lastError = `parse:${e instanceof Error ? e.message : String(e)}`;
      }
    }
    throw new StructuredParseError('llamacpp', 3, lastError);
  }
}

function zodToGrammar(_schema: ZodTypeAny): string {
  return [
    'root   ::= object',
    'object ::= "{" ws (string ":" ws value ("," ws string ":" ws value)*)? "}"',
    'array  ::= "[" ws (value ("," ws value)*)? "]"',
    'value  ::= object | array | string | number | "true" | "false" | "null"',
    'string ::= "\\"" ([^"\\\\] | "\\\\" .)* "\\""',
    'number ::= "-"? [0-9]+ ("." [0-9]+)?',
    'ws     ::= [ \\t\\n]*',
  ].join('\n');
}

export const __testing = { zodToGrammar };
