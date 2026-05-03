// SPDX-License-Identifier: BUSL-1.1
import type { ZodSchema } from 'zod';
import type {
  CompletionOpts,
  CompletionResult,
  ProviderCapabilities,
  ProviderMetadata,
  ReasoningResult,
} from '../types.js';
import type { PromptTemplateRegistry } from '../templates/registry.js';
import { BaseProvider } from './base.js';
import { StructuredParseError } from '../errors.js';

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'json_schema'; json_schema?: unknown };
  reasoning?: { effort: 'low' | 'medium' | 'high' };
}

export interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: { message: { content: string; reasoning?: string }; finish_reason: string }[];
  usage: { prompt_tokens: number; completion_tokens: number };
}

export interface OpenAIEmbeddingRequest {
  model: string;
  input: string[];
}

export interface OpenAIEmbeddingResponse {
  data: { embedding: number[]; index: number }[];
  model: string;
}

export interface OpenAIClient {
  chatCompletions(req: OpenAIChatRequest): Promise<OpenAIChatResponse>;
  embeddings(req: OpenAIEmbeddingRequest): Promise<OpenAIEmbeddingResponse>;
}

export interface OpenAIConfig {
  defaultModel: string;
  reasoningModel?: string;
  embeddingModel?: string;
  contextWindow?: number;
  templates: PromptTemplateRegistry;
  client: OpenAIClient;
  costPerKToken?: { input: number; output: number };
}

export class OpenAIProvider extends BaseProvider {
  constructor(private readonly cfg: OpenAIConfig) {
    super({ templates: cfg.templates });
  }

  isCloud(): boolean {
    return true;
  }

  capabilities(): ProviderCapabilities {
    return { supportsReasoning: true, supportsEmbedding: true, supportsGrammar: false };
  }

  metadata(): ProviderMetadata {
    return {
      provider: 'openai',
      modelName: this.cfg.defaultModel,
      modelVersion: this.cfg.defaultModel,
      contextWindow: this.cfg.contextWindow ?? 128000,
    };
  }

  async complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    const start = Date.now();
    const res = await this.cfg.client.chatCompletions({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature ?? 0,
      max_tokens: opts.maxTokens ?? 2048,
    });
    const text = res.choices[0]?.message.content ?? '';
    const cost = this.cfg.costPerKToken
      ? (res.usage.prompt_tokens / 1000) * this.cfg.costPerKToken.input +
        (res.usage.completion_tokens / 1000) * this.cfg.costPerKToken.output
      : undefined;
    return {
      output: text,
      tokensUsed: {
        input: res.usage.prompt_tokens,
        output: res.usage.completion_tokens,
      },
      latencyMs: Date.now() - start,
      ...(cost !== undefined ? { costUsd: cost } : {}),
      modelMetadata: {
        provider: 'openai',
        modelName: res.model,
        modelVersion: res.model,
        contextWindow: this.cfg.contextWindow ?? 128000,
      },
    };
  }

  async embed(input: string | string[], opts?: { model?: string }): Promise<number[][]> {
    const inputs = Array.isArray(input) ? input : [input];
    const model = opts?.model ?? this.cfg.embeddingModel ?? 'text-embedding-3-small';
    const res = await this.cfg.client.embeddings({ model, input: inputs });
    return res.data.map((d) => d.embedding);
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
      const res = await this.cfg.client.chatCompletions({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: opts.temperature ?? 0,
        max_tokens: opts.maxTokens ?? 1024,
        response_format: { type: 'json_object' },
      });
      const text = res.choices[0]?.message.content ?? '';
      try {
        const parsed = schema.safeParse(JSON.parse(text));
        if (parsed.success) return parsed.data;
        lastError = parsed.error.issues.map((i) => i.message).join('|');
      } catch (e) {
        lastError = `parse:${e instanceof Error ? e.message : String(e)}`;
      }
    }
    throw new StructuredParseError('openai', 3, lastError);
  }

  override async reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.reasoningModel ?? this.cfg.defaultModel;
    const start = Date.now();
    const res = await this.cfg.client.chatCompletions({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts.maxTokens ?? 4096,
      reasoning: { effort: opts.effortLevel ?? 'medium' },
      response_format: { type: 'json_object' },
    });
    const text = res.choices[0]?.message.content ?? '';
    const reasoning = res.choices[0]?.message.reasoning ?? '';
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      throw new StructuredParseError('openai', 1, 'invalid JSON answer');
    }
    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new StructuredParseError(
        'openai',
        1,
        parsed.error.issues.map((i) => i.message).join('|'),
      );
    }
    return {
      value: parsed.data,
      reasoningTrace: reasoning,
      raw: {
        output: text,
        tokensUsed: {
          input: res.usage.prompt_tokens,
          output: res.usage.completion_tokens,
        },
        latencyMs: Date.now() - start,
        modelMetadata: {
          provider: 'openai',
          modelName: res.model,
          modelVersion: res.model,
          contextWindow: this.cfg.contextWindow ?? 128000,
        },
      },
    };
  }
}
