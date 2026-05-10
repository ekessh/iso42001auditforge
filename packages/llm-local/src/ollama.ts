// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { HttpClient, parseNdjson, type FetchLike } from './http.js';
import {
  LocalLlmClientConfigSchema,
  LocalLlmError,
  LocalLlmModelNotFoundError,
  type ChatMessage,
  type ChatResponse,
  type EmbedResponse,
  type GenerateOptions,
  type GenerateResponse,
  type HealthReport,
  type LocalLlmAdapter,
  type LocalLlmClientConfig,
  type ModelInfo,
  type StreamChunk,
} from './types.js';

/* ─────────────────────────── Wire schemas ─────────────────────────── */

const TagsResponseSchema = z.object({
  models: z
    .array(
      z.object({
        name: z.string(),
        size: z.number().optional(),
        digest: z.string().optional(),
        modified_at: z.string().optional(),
        details: z
          .object({
            parameter_size: z.string().optional(),
            quantization_level: z.string().optional(),
          })
          .partial()
          .optional(),
      }),
    )
    .default([]),
});

const GenerateChunkSchema = z.object({
  model: z.string(),
  response: z.string().optional(),
  done: z.boolean(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  total_duration: z.number().optional(),
  error: z.string().optional(),
});
type GenerateChunk = z.infer<typeof GenerateChunkSchema>;

const ChatChunkSchema = z.object({
  model: z.string(),
  message: z
    .object({
      role: z.string(),
      content: z.string(),
    })
    .optional(),
  done: z.boolean(),
  done_reason: z.string().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  total_duration: z.number().optional(),
  error: z.string().optional(),
});
type ChatChunk = z.infer<typeof ChatChunkSchema>;

const EmbedResponseSchema = z.object({
  embedding: z.array(z.number()).optional(),
  embeddings: z.array(z.array(z.number())).optional(),
});

/* ─────────────────────────── Adapter ─────────────────────────── */

export interface OllamaAdapterOptions {
  readonly baseUrl?: string;
  readonly defaultTimeoutMs?: number;
  readonly retry?: Partial<LocalLlmClientConfig['retry']>;
  readonly fetchImpl?: FetchLike;
}

const finishReasonOf = (raw: string | undefined): 'stop' | 'length' | 'error' | undefined => {
  if (raw === undefined) return undefined;
  if (raw === 'stop' || raw === 'eos' || raw === 'eot') return 'stop';
  if (raw === 'length' || raw === 'limit') return 'length';
  return 'error';
};

/**
 * Ollama HTTP API adapter. Default for AuditForge per ADR-0005.
 */
export class OllamaAdapter implements LocalLlmAdapter {
  public readonly kind = 'ollama' as const;
  public readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(opts: OllamaAdapterOptions = {}) {
    const cfg: LocalLlmClientConfig = LocalLlmClientConfigSchema.parse({
      kind: 'ollama',
      baseUrl: opts.baseUrl ?? 'http://127.0.0.1:11434',
      defaultTimeoutMs: opts.defaultTimeoutMs ?? 60_000,
      retry: {
        maxAttempts: opts.retry?.maxAttempts ?? 3,
        initialDelayMs: opts.retry?.initialDelayMs ?? 100,
        maxDelayMs: opts.retry?.maxDelayMs ?? 2000,
        backoffFactor: opts.retry?.backoffFactor ?? 2,
      },
    });
    this.baseUrl = cfg.baseUrl;
    const httpOpts = {
      baseUrl: cfg.baseUrl,
      defaultTimeoutMs: cfg.defaultTimeoutMs,
      retry: cfg.retry,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
    };
    this.http = new HttpClient(httpOpts);
  }

  async health(modelHint?: string): Promise<HealthReport> {
    const start = Date.now();
    try {
      const models = await this.listModels();
      const latencyMs = Date.now() - start;
      const modelLoaded = modelHint && models.some((m) => m.name === modelHint)
        ? modelHint
        : models[0]?.name;
      const report: HealthReport = {
        reachable: true,
        latencyMs,
        models,
        ...(modelLoaded !== undefined ? { modelLoaded } : {}),
      };
      return report;
    } catch {
      return {
        reachable: false,
        latencyMs: Date.now() - start,
        models: [],
      };
    }
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    const res = await this.http.request('/api/tags', { method: 'GET' });
    const json = (await res.json()) as unknown;
    const parsed = TagsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /api/tags payload', false, parsed.error);
    }
    return parsed.data.models.map((m) => {
      const info: ModelInfo = {
        name: m.name,
        ...(m.size !== undefined ? { sizeBytes: m.size } : {}),
        ...(m.digest !== undefined ? { digest: m.digest } : {}),
        ...(m.details?.parameter_size !== undefined ? { parameterSize: m.details.parameter_size } : {}),
        ...(m.details?.quantization_level !== undefined ? { quantization: m.details.quantization_level } : {}),
        ...(m.modified_at !== undefined ? { modifiedAt: m.modified_at } : {}),
      };
      return info;
    });
  }

  async pullModel(name: string): Promise<void> {
    const res = await this.http.stream(
      '/api/pull',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, stream: true }),
      },
      { timeoutMs: 30 * 60 * 1000 },
    );
    // Drain progress NDJSON until done.
    for await (const _frame of parseNdjson<{ status?: string; error?: string }>(res)) {
      if (_frame.error) {
        throw new LocalLlmError('LLM_PULL_FAILED', _frame.error, false);
      }
    }
  }

  async generate(
    model: string,
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResponse> {
    let text = '';
    let stats: GenerateChunk | undefined;
    for await (const c of this.rawGenerate(model, prompt, { ...options, stream: true })) {
      text += c.response ?? '';
      if (c.done) stats = c;
    }
    const genFinishReason = finishReasonOf(stats?.done_reason);
    const result: GenerateResponse = {
      model,
      text,
      ...(stats?.prompt_eval_count !== undefined ? { promptTokens: stats.prompt_eval_count } : {}),
      ...(stats?.eval_count !== undefined ? { completionTokens: stats.eval_count } : {}),
      ...(stats?.total_duration !== undefined ? { totalDurationMs: Math.round(stats.total_duration / 1_000_000) } : {}),
      ...(genFinishReason !== undefined ? { finishReason: genFinishReason } : {}),
    };
    return result;
  }

  async *generateStream(
    model: string,
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncIterable<StreamChunk> {
    for await (const c of this.rawGenerate(model, prompt, { ...options, stream: true })) {
      const streamFinishReason = finishReasonOf(c.done_reason);
      const stats: StreamChunk['stats'] = c.done
        ? {
            ...(c.prompt_eval_count !== undefined ? { promptTokens: c.prompt_eval_count } : {}),
            ...(c.eval_count !== undefined ? { completionTokens: c.eval_count } : {}),
            ...(c.total_duration !== undefined ? { totalDurationMs: Math.round(c.total_duration / 1_000_000) } : {}),
            ...(streamFinishReason !== undefined ? { finishReason: streamFinishReason } : {}),
          }
        : undefined;
      const chunk: StreamChunk = {
        text: c.response ?? '',
        done: c.done,
        ...(stats !== undefined ? { stats } : {}),
      };
      yield chunk;
    }
  }

  async chat(
    model: string,
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<ChatResponse> {
    let text = '';
    let stats: ChatChunk | undefined;
    for await (const c of this.rawChat(model, messages, { ...options, stream: true })) {
      text += c.message?.content ?? '';
      if (c.done) stats = c;
    }
    const chatGenFinishReason = finishReasonOf(stats?.done_reason);
    const result: ChatResponse = {
      model,
      text,
      message: { role: 'assistant', content: text },
      ...(stats?.prompt_eval_count !== undefined ? { promptTokens: stats.prompt_eval_count } : {}),
      ...(stats?.eval_count !== undefined ? { completionTokens: stats.eval_count } : {}),
      ...(stats?.total_duration !== undefined ? { totalDurationMs: Math.round(stats.total_duration / 1_000_000) } : {}),
      ...(chatGenFinishReason !== undefined ? { finishReason: chatGenFinishReason } : {}),
    };
    return result;
  }

  async *chatStream(
    model: string,
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncIterable<StreamChunk> {
    for await (const c of this.rawChat(model, messages, { ...options, stream: true })) {
      const chatStreamFinishReason = finishReasonOf(c.done_reason);
      const stats: StreamChunk['stats'] = c.done
        ? {
            ...(c.prompt_eval_count !== undefined ? { promptTokens: c.prompt_eval_count } : {}),
            ...(c.eval_count !== undefined ? { completionTokens: c.eval_count } : {}),
            ...(c.total_duration !== undefined ? { totalDurationMs: Math.round(c.total_duration / 1_000_000) } : {}),
            ...(chatStreamFinishReason !== undefined ? { finishReason: chatStreamFinishReason } : {}),
          }
        : undefined;
      const chunk: StreamChunk = {
        text: c.message?.content ?? '',
        done: c.done,
        ...(stats !== undefined ? { stats } : {}),
      };
      yield chunk;
    }
  }

  async embed(model: string, text: string): Promise<EmbedResponse> {
    const res = await this.http.request('/api/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    const json = (await res.json()) as unknown;
    const parsed = EmbedResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /api/embeddings payload', false, parsed.error);
    }
    const vector = parsed.data.embedding ?? parsed.data.embeddings?.[0];
    if (!vector || vector.length === 0) {
      throw new LocalLlmError('LLM_EMPTY_EMBEDDING', 'Embedding response was empty', false);
    }
    return { model, vector, dim: vector.length };
  }

  /* ─────────────────────────── Internals ─────────────────────────── */

  private buildOptions(options: GenerateOptions): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    if (options.temperature !== undefined) o.temperature = options.temperature;
    if (options.topP !== undefined) o.top_p = options.topP;
    if (options.topK !== undefined) o.top_k = options.topK;
    if (options.maxTokens !== undefined) o.num_predict = options.maxTokens;
    if (options.stop !== undefined) o.stop = options.stop;
    if (options.seed !== undefined) o.seed = options.seed;
    return o;
  }

  private async *rawGenerate(
    model: string,
    prompt: string,
    options: GenerateOptions,
  ): AsyncGenerator<GenerateChunk> {
    const body = JSON.stringify({
      model,
      prompt,
      stream: options.stream ?? true,
      options: this.buildOptions(options),
    });
    const res = await this.http.stream(
      '/api/generate',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    for await (const frame of parseNdjson<unknown>(res)) {
      const parsed = GenerateChunkSchema.safeParse(frame);
      if (!parsed.success) {
        throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid generate frame', false, parsed.error);
      }
      if (parsed.data.error) {
        if (/not found|no such model|pull/i.test(parsed.data.error)) {
          throw new LocalLlmModelNotFoundError(model);
        }
        throw new LocalLlmError('LLM_RUNTIME_ERROR', parsed.data.error, false);
      }
      yield parsed.data;
    }
  }

  private async *rawChat(
    model: string,
    messages: readonly ChatMessage[],
    options: GenerateOptions,
  ): AsyncGenerator<ChatChunk> {
    const body = JSON.stringify({
      model,
      messages,
      stream: options.stream ?? true,
      options: this.buildOptions(options),
    });
    const res = await this.http.stream(
      '/api/chat',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    for await (const frame of parseNdjson<unknown>(res)) {
      const parsed = ChatChunkSchema.safeParse(frame);
      if (!parsed.success) {
        throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid chat frame', false, parsed.error);
      }
      if (parsed.data.error) {
        if (/not found|no such model|pull/i.test(parsed.data.error)) {
          throw new LocalLlmModelNotFoundError(model);
        }
        throw new LocalLlmError('LLM_RUNTIME_ERROR', parsed.data.error, false);
      }
      yield parsed.data;
    }
  }
}
