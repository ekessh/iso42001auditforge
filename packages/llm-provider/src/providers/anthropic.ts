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

export interface AnthropicMessageBlock {
  type: 'text' | 'thinking' | 'tool_use';
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
}

export interface AnthropicResponse {
  id: string;
  model: string;
  content: AnthropicMessageBlock[];
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

export interface AnthropicMessageRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: { role: 'user' | 'assistant'; content: string | AnthropicMessageBlock[] }[];
  thinking?: { type: 'enabled'; budget_tokens: number };
  tools?: {
    name: string;
    description: string;
    input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  }[];
  tool_choice?: { type: 'tool'; name: string };
}

export interface AnthropicMessagesClient {
  create(req: AnthropicMessageRequest): Promise<AnthropicResponse>;
}

export interface AnthropicConfig {
  defaultModel: string;
  reasoningModel?: string;
  contextWindow?: number;
  templates: PromptTemplateRegistry;
  client: AnthropicMessagesClient;
  costPerKToken?: { input: number; output: number };
}

export class AnthropicProvider extends BaseProvider {
  constructor(private readonly cfg: AnthropicConfig) {
    super({ templates: cfg.templates });
  }

  isCloud(): boolean {
    return true;
  }

  capabilities(): ProviderCapabilities {
    return { supportsReasoning: true, supportsEmbedding: false, supportsGrammar: false };
  }

  metadata(): ProviderMetadata {
    return {
      provider: 'anthropic',
      modelName: this.cfg.defaultModel,
      modelVersion: this.cfg.defaultModel,
      contextWindow: this.cfg.contextWindow ?? 200000,
    };
  }

  async complete(prompt: string, opts: CompletionOpts): Promise<CompletionResult> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    const start = Date.now();
    const res = await this.cfg.client.create({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    const cost = this.cfg.costPerKToken
      ? (res.usage.input_tokens / 1000) * this.cfg.costPerKToken.input +
        (res.usage.output_tokens / 1000) * this.cfg.costPerKToken.output
      : undefined;
    return {
      output: text,
      tokensUsed: { input: res.usage.input_tokens, output: res.usage.output_tokens },
      latencyMs: Date.now() - start,
      ...(cost !== undefined ? { costUsd: cost } : {}),
      modelMetadata: {
        provider: 'anthropic',
        modelName: res.model,
        modelVersion: res.model,
        contextWindow: this.cfg.contextWindow ?? 200000,
      },
    };
  }

  async embed(): Promise<number[][]> {
    throw new Error('AnthropicProvider does not support embeddings; use a local embedder');
  }

  override async classifyStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts,
  ): Promise<T> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.defaultModel;
    const tool = {
      name: 'submit_classification',
      description: 'Submit the classification result conforming to the required schema.',
      input_schema: zodToJsonObjectSchema(schema),
    };
    let lastError = '';
    for (let i = 0; i < 3; i++) {
      const res = await this.cfg.client.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0,
        messages: [{ role: 'user', content: prompt }],
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
      });
      const toolUse = res.content.find((b) => b.type === 'tool_use');
      if (!toolUse) {
        lastError = 'no tool_use block returned';
        continue;
      }
      const parsed = schema.safeParse(toolUse.input);
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.map((i) => i.message).join('|');
    }
    throw new StructuredParseError('anthropic', 3, lastError);
  }

  override async reasonStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    opts: CompletionOpts & { effortLevel?: 'low' | 'medium' | 'high' },
  ): Promise<ReasoningResult<T>> {
    this.ensureTemplate(opts.promptTemplateVersion);
    const model = opts.model ?? this.cfg.reasoningModel ?? this.cfg.defaultModel;
    const budget = effortToThinkingBudget(opts.effortLevel ?? 'medium');
    const start = Date.now();
    const res = await this.cfg.client.create({
      model,
      max_tokens: Math.max(opts.maxTokens ?? 4096, budget + 1024),
      messages: [{ role: 'user', content: prompt }],
      thinking: { type: 'enabled', budget_tokens: budget },
    });
    const reasoning = res.content
      .filter((b) => b.type === 'thinking')
      .map((b) => b.thinking ?? '')
      .join('\n');
    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    const json = extractJson(text);
    if (json === null) {
      throw new StructuredParseError('anthropic', 1, 'no JSON in answer');
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new StructuredParseError(
        'anthropic',
        1,
        parsed.error.issues.map((i) => i.message).join('|'),
      );
    }
    return {
      value: parsed.data,
      reasoningTrace: reasoning,
      raw: {
        output: text,
        tokensUsed: { input: res.usage.input_tokens, output: res.usage.output_tokens },
        latencyMs: Date.now() - start,
        modelMetadata: {
          provider: 'anthropic',
          modelName: res.model,
          modelVersion: res.model,
          contextWindow: this.cfg.contextWindow ?? 200000,
        },
      },
    };
  }
}

function effortToThinkingBudget(level: 'low' | 'medium' | 'high'): number {
  switch (level) {
    case 'low':
      return 1024;
    case 'medium':
      return 4096;
    case 'high':
      return 16384;
  }
}

function extractJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

function zodToJsonObjectSchema(_schema: unknown): {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
} {
  return { type: 'object', properties: {}, required: [] };
}

export const __testing = { effortToThinkingBudget, extractJson };
