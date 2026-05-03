// SPDX-License-Identifier: BUSL-1.1
import { vi } from 'vitest';

/**
 * Build a fake `fetch` that responds to a queue of canned responses, matched
 * sequentially. Throws if more requests come in than responses.
 */
export interface MockResponseSpec {
  status?: number;
  body?: string | Uint8Array | ReadableStream<Uint8Array>;
  headers?: Record<string, string>;
  /** If set, the fetch promise rejects with this error (network failure). */
  reject?: Error;
  /** Delay before resolving/rejecting (ms). */
  delayMs?: number;
}

export interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
}

export interface MockFetchHandle {
  fetch: typeof fetch;
  requests: CapturedRequest[];
}

export function makeMockFetch(responses: MockResponseSpec[]): MockFetchHandle {
  const queue = [...responses];
  const requests: CapturedRequest[] = [];

  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers;
    if (rawHeaders) {
      if (rawHeaders instanceof Headers) {
        rawHeaders.forEach((v, k) => (headers[k.toLowerCase()] = v));
      } else if (Array.isArray(rawHeaders)) {
        for (const [k, v] of rawHeaders) headers[k.toLowerCase()] = v;
      } else {
        for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = String(v);
      }
    }
    const body = typeof init?.body === 'string' ? init.body : undefined;
    requests.push({ url, method, headers, body });

    const next = queue.shift();
    if (!next) {
      throw new Error(`makeMockFetch: no response queued for ${method} ${url}`);
    }

    // Honour AbortSignal cancellation.
    const signal = init?.signal;

    if (next.delayMs && next.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, next.delayMs);
        if (signal) {
          if (signal.aborted) {
            clearTimeout(t);
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          } else {
            signal.addEventListener('abort', () => {
              clearTimeout(t);
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
        }
      });
    }

    if (next.reject) throw next.reject;

    const status = next.status ?? 200;
    const respHeaders = new Headers(next.headers ?? {});
    if (typeof next.body === 'string') {
      return new Response(next.body, { status, headers: respHeaders });
    }
    if (next.body instanceof Uint8Array) {
      return new Response(next.body, { status, headers: respHeaders });
    }
    if (next.body && typeof (next.body as ReadableStream<Uint8Array>).getReader === 'function') {
      return new Response(next.body, { status, headers: respHeaders });
    }
    return new Response(null, { status, headers: respHeaders });
  });

  return { fetch: fn as unknown as typeof fetch, requests };
}

/**
 * Build a ReadableStream that emits the given chunks (strings) as Uint8Array
 * with optional inter-chunk delays — useful to simulate Ollama NDJSON streaming.
 */
export function makeNdjsonStream(
  frames: string[],
  delayMsBetween = 0,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= frames.length) {
        controller.close();
        return;
      }
      const f = frames[i++]!;
      controller.enqueue(encoder.encode(f.endsWith('\n') ? f : `${f}\n`));
      if (delayMsBetween > 0) {
        await new Promise((r) => setTimeout(r, delayMsBetween));
      }
    },
  });
}

/**
 * Build a connection-refused style error matching what node:undici throws.
 */
export function makeConnRefused(): Error {
  const err = new TypeError('fetch failed');
  (err as unknown as { cause: { code: string } }).cause = { code: 'ECONNREFUSED' };
  return err;
}

/**
 * Build an SSE stream of OpenAI-style `data: ...\n\n` events.
 */
export function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= events.length) {
        controller.close();
        return;
      }
      const e = events[i++]!;
      controller.enqueue(encoder.encode(`data: ${e}\n\n`));
    },
  });
}
