// SPDX-License-Identifier: BUSL-1.1
import {
  LocalLlmError,
  LocalLlmHttpError,
  LocalLlmTimeoutError,
  LocalLlmUnreachableError,
  type RetryConfig,
} from './types.js';

export type FetchLike = typeof fetch;

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly defaultTimeoutMs: number;
  readonly retry: RetryConfig;
  readonly fetchImpl?: FetchLike;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Heuristic for "connection refused" / network errors that should be retried.
 * Node's undici raises TypeError("fetch failed") with a cause carrying
 * { code: 'ECONNREFUSED' | 'ENOTFOUND' | 'ECONNRESET' | 'EAI_AGAIN' }.
 */
export function isNetworkError(err: unknown): boolean {
  if (err instanceof LocalLlmUnreachableError) return true;
  if (err instanceof LocalLlmTimeoutError) return true;
  if (!(err instanceof Error)) return false;
  const cause = (err as { cause?: { code?: string } }).cause;
  const code = cause?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  ) {
    return true;
  }
  // Best-effort: fetch in node throws TypeError('fetch failed') for net errors.
  if (err.name === 'TypeError' && /fetch failed|network/i.test(err.message)) {
    return true;
  }
  return false;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;
  private readonly retry: RetryConfig;
  private readonly fetchImpl: FetchLike;

  constructor(opts: HttpClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.defaultTimeoutMs = opts.defaultTimeoutMs;
    this.retry = opts.retry;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  /**
   * One attempt — applies timeout but no retry.
   * Errors are normalized to LocalLlmError subclasses.
   */
  private async tryOnce(
    path: string,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let externalAbortListener: (() => void) | undefined;
    if (externalSignal) {
      if (externalSignal.aborted) ctrl.abort();
      else {
        externalAbortListener = () => ctrl.abort();
        externalSignal.addEventListener('abort', externalAbortListener, { once: true });
      }
    }

    try {
      const res = await this.fetchImpl(this.url(path), { ...init, signal: ctrl.signal });
      if (!res.ok) {
        const body = await safeReadText(res);
        throw new LocalLlmHttpError(res.status, body);
      }
      return res;
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') {
        if (externalSignal?.aborted) {
          throw new LocalLlmError('LLM_ABORTED', 'Request aborted by caller', false, err);
        }
        throw new LocalLlmTimeoutError(timeoutMs);
      }
      if (err instanceof LocalLlmError) throw err;
      if (isNetworkError(err)) {
        throw new LocalLlmUnreachableError(this.baseUrl, err);
      }
      throw new LocalLlmError('LLM_UNKNOWN', String((err as Error).message ?? err), false, err);
    } finally {
      clearTimeout(timer);
      if (externalSignal && externalAbortListener) {
        externalSignal.removeEventListener('abort', externalAbortListener);
      }
    }
  }

  /**
   * Request with bounded retry + exponential backoff for retryable errors.
   * Streams (`stream=true` body or response that callers want to read) MUST
   * call tryOnce directly so retries don't break partial readers.
   */
  async request(
    path: string,
    init: RequestInit,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<Response> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    let attempt = 0;
    let delay = this.retry.initialDelayMs;
    let lastErr: unknown;

    while (attempt < this.retry.maxAttempts) {
      attempt++;
      try {
        return await this.tryOnce(path, init, timeoutMs, options?.signal);
      } catch (err) {
        lastErr = err;
        const retryable = err instanceof LocalLlmError ? err.retryable : false;
        if (!retryable || attempt >= this.retry.maxAttempts) break;
        await sleep(Math.min(delay, this.retry.maxDelayMs));
        delay = Math.min(delay * this.retry.backoffFactor, this.retry.maxDelayMs);
      }
    }
    throw lastErr;
  }

  /**
   * Single attempt — for streaming endpoints. Caller is responsible for handling
   * connection errors and choosing whether to retry the whole stream.
   */
  async stream(
    path: string,
    init: RequestInit,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<Response> {
    const timeoutMs = options?.timeoutMs ?? this.defaultTimeoutMs;
    return this.tryOnce(path, init, timeoutMs, options?.signal);
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/**
 * Async-iterable NDJSON parser over a fetch Response.body. Each yielded value
 * is a parsed JSON object. Partial frames are buffered until newline. Empty
 * lines are skipped.
 */
export async function* parseNdjson<T>(res: Response): AsyncGenerator<T> {
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
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line.length > 0) {
          try {
            yield JSON.parse(line) as T;
          } catch (e) {
            throw new LocalLlmError('LLM_BAD_NDJSON', `Invalid NDJSON frame: ${line.slice(0, 256)}`, false, e);
          }
        }
        nl = buffer.indexOf('\n');
      }
    }
    const rest = buffer.trim();
    if (rest.length > 0) {
      try {
        yield JSON.parse(rest) as T;
      } catch (e) {
        throw new LocalLlmError('LLM_BAD_NDJSON', `Invalid trailing NDJSON frame: ${rest.slice(0, 256)}`, false, e);
      }
    }
  } finally {
    reader.releaseLock();
  }
}
