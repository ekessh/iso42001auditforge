// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import { HttpClient, type FetchLike } from './http.js';
import {
  LocalLlmClientConfigSchema,
  LocalLlmError,
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

/* ─────────────────────────── Wire schemas (OpenAI-compatible) ─────────────────────────── */

const ModelsResponseSchema = z.object({
  data: z
    .array(
      z.object({
        id: z.string(),
        object: z.string().optional(),
        created: z.number().optional(),
        owned_by: z.string().optional(),
      }),
    )
    .default([]),
});

const CompletionResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  choices: z.array(
    z.object({
      text: z.string(),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const ChatCompletionResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.string(),
        content: z.string(),
      }),
      finish_reason: z.string().nullable().optional(),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
      total_tokens: z.number().optional(),
    })
    .optional(),
});

const EmbeddingResponseSchema = z.object({
  model: z.string(),
  data: z.array(
    z.object({
      embedding: z.array(z.number()),
    }),
  ),
});

/* ─────────────────────────── Adapter ─────────────────────────── */

export interface VllmAdapterOptions {
  readonly baseUrl?: string;
  readonly defaultTimeoutMs?: number;
  readonly retry?: Partial<LocalLlmClientConfig['retry']>;
  readonly fetchImpl?: FetchLike;
  readonly apiKey?: string;
}

const finishReasonOf = (raw: string | null | undefined): 'stop' | 'length' | 'error' | undefined => {
  if (raw === null || raw === undefined) return undefined;
  if (raw === 'stop') return 'stop';
  if (raw === 'length') return 'length';
  return 'error';
};

/**
 * vLLM adapter — speaks the OpenAI v1 REST dialect that vLLM serves at /v1/*.
 * Optional companion to the Ollama adapter.
 */
export class VllmAdapter implements LocalLlmAdapter {
  public readonly kind = 'vllm' as const;
  public readonly baseUrl: string;
  private readonly http: HttpClient;
  private readonly authHeaders: Record<string, string>;

  constructor(opts: VllmAdapterOptions = {}) {
    const cfg: LocalLlmClientConfig = LocalLlmClientConfigSchema.parse({
      kind: 'vllm',
      baseUrl: opts.baseUrl ?? 'http://127.0.0.1:8000',
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
    this.authHeaders = opts.apiKey ? { authorization: `Bearer ${opts.apiKey}` } : {};
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
      return { reachable: false, latencyMs: Date.now() - start, models: [] };
    }
  }

  async listModels(): Promise<readonly ModelInfo[]> {
    const res = await this.http.request('/v1/models', {
      method: 'GET',
      headers: { ...this.authHeaders },
    });
    const json = (await res.json()) as unknown;
    const parsed = ModelsResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /v1/models payload', false, parsed.error);
    }
    return parsed.data.data.map((m) => ({ name: m.id }));
  }

  async pullModel(_name: string): Promise<void> {
    // vLLM does not expose a runtime pull API; models are loaded at server start.
    // We treat this as a no-op so the adapter satisfies the same interface.
    return;
  }

  async generate(
    model: string,
    prompt: string,
    options: GenerateOptions = {},
  ): Promise<GenerateResponse> {
    const body = JSON.stringify({
      model,
      prompt,
      stream: false,
      ...this.buildOpenAiOptions(options),
    });
    const res = await this.http.request(
      '/v1/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders },
        body,
      },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    const json = (await res.json()) as unknown;
    const parsed = CompletionResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /v1/completions payload', false, parsed.error);
    }
    const choice = parsed.data.choices[0];
    if (!choice) throw new LocalLlmError('LLM_NO_CHOICE', 'vLLM returned no choices', false);
    const result: GenerateResponse = {
      model: parsed.data.model,
      text: choice.text,
      ...(parsed.data.usage?.prompt_tokens !== undefined ? { promptTokens: parsed.data.usage.prompt_tokens } : {}),
      ...(parsed.data.usage?.completion_tokens !== undefined ? { completionTokens: parsed.data.usage.completion_tokens } : {}),
      ...(finishReasonOf(choice.finish_reason) !== undefined ? { finishReason: finishReasonOf(choice.finish_reason) } : {}),
    };
    return result;
  }

  async *generateStream(
    model: string,
    prompt: string,
    options: GenerateOptions = {},
  ): AsyncIterable<StreamChunk> {
    const body = JSON.stringify({
      model,
      prompt,
      stream: true,
      ...this.buildOpenAiOptions(options),
    });
    const res = await this.http.stream(
      '/v1/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders },
        body,
      },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    yield* this.parseSseCompletions(res);
  }

  async chat(
    model: string,
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<ChatResponse> {
    const body = JSON.stringify({
      model,
      messages,
      stream: false,
      ...this.buildOpenAiOptions(options),
    });
    const res = await this.http.request(
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders },
        body,
      },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    const json = (await res.json()) as unknown;
    const parsed = ChatCompletionResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /v1/chat/completions payload', false, parsed.error);
    }
    const choice = parsed.data.choices[0];
    if (!choice) throw new LocalLlmError('LLM_NO_CHOICE', 'vLLM returned no choices', false);
    const result: ChatResponse = {
      model: parsed.data.model,
      text: choice.message.content,
      message: { role: 'assistant', content: choice.message.content },
      ...(parsed.data.usage?.prompt_tokens !== undefined ? { promptTokens: parsed.data.usage.prompt_tokens } : {}),
      ...(parsed.data.usage?.completion_tokens !== undefined ? { completionTokens: parsed.data.usage.completion_tokens } : {}),
      ...(finishReasonOf(choice.finish_reason) !== undefined ? { finishReason: finishReasonOf(choice.finish_reason) } : {}),
    };
    return result;
  }

  async *chatStream(
    model: string,
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncIterable<StreamChunk> {
    const body = JSON.stringify({
      model,
      messages,
      stream: true,
      ...this.buildOpenAiOptions(options),
    });
    const res = await this.http.stream(
      '/v1/chat/completions',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authHeaders },
        body,
      },
      {
        ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
        ...(options.signal !== undefined ? { signal: options.signal } : {}),
      },
    );
    yield* this.parseSseChat(res);
  }

  async embed(model: string, text: string): Promise<EmbedResponse> {
    const res = await this.http.request('/v1/embeddings', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.authHeaders },
      body: JSON.stringify({ model, input: text }),
    });
    const json = (await res.json()) as unknown;
    const parsed = EmbeddingResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new LocalLlmError('LLM_BAD_RESPONSE', 'Invalid /v1/embeddings payload', false, parsed.error);
    }
    const vector = parsed.data.data[0]?.embedding;
    if (!vector || vector.length === 0) {
      throw new LocalLlmError('LLM_EMPTY_EMBEDDING', 'Embedding response was empty', false);
    }
    return { model: parsed.data.model, vector, dim: vector.length };
  }

  /* ─────────────────────────── Internals ─────────────────────────── */

  private buildOpenAiOptions(options: GenerateOptions): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    if (options.temperature !== undefined) o.temperature = options.temperature;
    if (options.topP !== undefined) o.top_p = options.topP;
    if (options.maxTokens !== undefined) o.max_tokens = options.maxTokens;
    if (options.stop !== undefined) o.stop = options.stop;
    if (options.seed !== undefined) o.seed = options.seed;
    return o;
  }

  /**
   * Parse SSE stream from vLLM /v1/completions stream=true.
   */
  private async *parseSseCompletions(res: Response): AsyncGenerator<StreamChunk> {
    for await (const evt of parseSseEvents(res)) {
      if (evt === '[DONE]') {
        yield { text: '', done: true };
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(evt);
      } catch (e) {
        throw new LocalLlmError('LLM_BAD_SSE', 'Invalid SSE JSON', false, e);
      }
      const ok = z
        .object({
          choices: z.array(
            z.object({
              text: z.string().optional(),
              finish_reason: z.string().nullable().optional(),
            }),
          ),
        })
        .safeParse(parsed);
      if (!ok.success) continue;
      const c = ok.data.choices[0];
      if (!c) continue;
      const isFinal = c.finish_reason !== null && c.finish_reason !== undefined;
      const stats: StreamChunk['stats'] = isFinal
        ? finishReasonOf(c.finish_reason) !== undefined
          ? { finishReason: finishReasonOf(c.finish_reason) }
          : {}
        : undefined;
      yield {
        text: c.text ?? '',
        done: isFinal,
        ...(stats !== undefined ? { stats } : {}),
      };
    }
  }

  private async *parseSseChat(res: Response): AsyncGenerator<StreamChunk> {
    for await (const evt of parseSseEvents(res)) {
      if (evt === '[DONE]') {
        yield { text: '', done: true };
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(evt);
      } catch (e) {
        throw new LocalLlmError('LLM_BAD_SSE', 'Invalid SSE JSON', false, e);
      }
      const ok = z
        .object({
          choices: z.array(
            z.object({
              delta: z
                .object({
                  content: z.string().optional(),
                })
                .optional(),
              finish_reason: z.string().nullable().optional(),
            }),
          ),
        })
        .safeParse(parsed);
      if (!ok.success) continue;
      const c = ok.data.choices[0];
      if (!c) continue;
      const isFinal = c.finish_reason !== null && c.finish_reason !== undefined;
      const stats: StreamChunk['stats'] = isFinal
        ? finishReasonOf(c.finish_reason) !== undefined
          ? { finishReason: finishReasonOf(c.finish_reason) }
          : {}
        : undefined;
      yield {
        text: c.delta?.content ?? '',
        done: isFinal,
        ...(stats !== undefined ? { stats } : {}),
      };
    }
  }
}

/**
 * Parse OpenAI-style SSE: `data: <json>\n\n` framing. Yields each `data:` payload,
 * skipping comments and empty lines. Yields the literal sentinel `'[DONE]'` for the
 * terminating frame.
 */
async function* parseSseEvents(res: Response): AsyncGenerator<string> {
  const body = res.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl = buffer.indexOf('\n');
      while (nl >= 0) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        const trimmed = line.replace(/\r$/, '');
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6).trim();
          if (payload.length > 0) yield payload;
        }
        nl = buffer.indexOf('\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}
