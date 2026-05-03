// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

/* ─────────────────────────── Message + options ─────────────────────────── */

export const ChatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
  /**
   * Optional name for tool messages. Kept loose; tool calling is not part
   * of the local adapter v1 contract.
   */
  name: z.string().min(1).max(256).optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const GenerateOptionsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().int().min(1).max(1000).optional(),
  maxTokens: z.number().int().min(1).max(32_768).optional(),
  /** If true, the adapter pre-aggregates streamed chunks into one response. */
  stream: z.boolean().optional(),
  /** Stop sequences. */
  stop: z.array(z.string().min(1).max(64)).max(8).optional(),
  /** Random seed for deterministic decoding (Ollama supports this). */
  seed: z.number().int().nonnegative().optional(),
  /** Per-call timeout in ms. Defaults to client-level timeout. */
  timeoutMs: z.number().int().min(1).max(600_000).optional(),
  /** AbortSignal (not validated by Zod, supplied at call time). */
});
export type GenerateOptions = z.infer<typeof GenerateOptionsSchema> & {
  signal?: AbortSignal;
};

/* ─────────────────────────── Adapter responses ─────────────────────────── */

export interface GenerateResponse {
  readonly model: string;
  readonly text: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalDurationMs?: number;
  readonly finishReason?: 'stop' | 'length' | 'error';
}

export interface ChatResponse extends GenerateResponse {
  readonly message: ChatMessage;
}

export interface StreamChunk {
  readonly text: string;
  readonly done: boolean;
  /** Final aggregated stats only present on the last chunk (done=true). */
  readonly stats?: {
    readonly promptTokens?: number;
    readonly completionTokens?: number;
    readonly totalDurationMs?: number;
    readonly finishReason?: 'stop' | 'length' | 'error';
  };
}

export interface EmbedResponse {
  readonly model: string;
  readonly vector: readonly number[];
  readonly dim: number;
}

export interface ModelInfo {
  readonly name: string;
  readonly sizeBytes?: number;
  readonly digest?: string;
  readonly parameterSize?: string;
  readonly quantization?: string;
  readonly modifiedAt?: string;
}

export interface HealthReport {
  readonly reachable: boolean;
  readonly latencyMs: number;
  readonly models: readonly ModelInfo[];
  readonly modelLoaded?: string;
}

/* ─────────────────────────── Adapter interface ─────────────────────────── */

export interface LocalLlmAdapter {
  readonly kind: 'ollama' | 'vllm';
  readonly baseUrl: string;

  health(modelHint?: string): Promise<HealthReport>;

  listModels(): Promise<readonly ModelInfo[]>;

  pullModel(name: string): Promise<void>;

  generate(
    model: string,
    prompt: string,
    options?: GenerateOptions,
  ): Promise<GenerateResponse>;

  generateStream(
    model: string,
    prompt: string,
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk>;

  chat(
    model: string,
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): Promise<ChatResponse>;

  chatStream(
    model: string,
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): AsyncIterable<StreamChunk>;

  embed(model: string, text: string): Promise<EmbedResponse>;
}

/* ─────────────────────────── Errors ─────────────────────────── */

export class LocalLlmError extends Error {
  public readonly code: string;
  public readonly cause?: unknown;
  public readonly retryable: boolean;
  constructor(code: string, message: string, retryable: boolean, cause?: unknown) {
    super(message);
    this.name = 'LocalLlmError';
    this.code = code;
    this.retryable = retryable;
    if (cause !== undefined) this.cause = cause;
    Object.setPrototypeOf(this, LocalLlmError.prototype);
  }
}

export class LocalLlmUnreachableError extends LocalLlmError {
  constructor(baseUrl: string, cause?: unknown) {
    super('LLM_UNREACHABLE', `Local LLM unreachable at ${baseUrl}`, true, cause);
    Object.setPrototypeOf(this, LocalLlmUnreachableError.prototype);
  }
}

export class LocalLlmModelNotFoundError extends LocalLlmError {
  public readonly model: string;
  constructor(model: string) {
    super('MODEL_NOT_FOUND', `Local LLM model not found: ${model}`, false);
    this.model = model;
    Object.setPrototypeOf(this, LocalLlmModelNotFoundError.prototype);
  }
}

export class LocalLlmHttpError extends LocalLlmError {
  public readonly status: number;
  public readonly body: string;
  constructor(status: number, body: string) {
    const retryable = status >= 500 || status === 408 || status === 429;
    super(
      'LLM_HTTP_ERROR',
      `Local LLM HTTP ${status}: ${body.slice(0, 256)}`,
      retryable,
    );
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, LocalLlmHttpError.prototype);
  }
}

export class LocalLlmTimeoutError extends LocalLlmError {
  constructor(ms: number) {
    super('LLM_TIMEOUT', `Local LLM request timed out after ${ms}ms`, true);
    Object.setPrototypeOf(this, LocalLlmTimeoutError.prototype);
  }
}

/* ─────────────────────────── Client config ─────────────────────────── */

export const RetryConfigSchema = z.object({
  maxAttempts: z.number().int().min(1).max(10).default(3),
  initialDelayMs: z.number().int().min(1).max(10_000).default(100),
  maxDelayMs: z.number().int().min(1).max(60_000).default(2000),
  backoffFactor: z.number().min(1).max(10).default(2),
});
export type RetryConfig = z.infer<typeof RetryConfigSchema>;

export const LocalLlmClientConfigSchema = z.object({
  kind: z.enum(['ollama', 'vllm']),
  baseUrl: z.string().url(),
  defaultTimeoutMs: z.number().int().min(1).max(600_000).default(60_000),
  retry: RetryConfigSchema.default({
    maxAttempts: 3,
    initialDelayMs: 100,
    maxDelayMs: 2000,
    backoffFactor: 2,
  }),
});
export type LocalLlmClientConfig = z.infer<typeof LocalLlmClientConfigSchema>;
