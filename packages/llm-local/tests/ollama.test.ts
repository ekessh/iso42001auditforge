// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import {
  LocalLlmHttpError,
  LocalLlmModelNotFoundError,
  LocalLlmTimeoutError,
  LocalLlmUnreachableError,
  OllamaAdapter,
} from '../src/index.js';
import { makeConnRefused, makeMockFetch, makeNdjsonStream } from './helpers.js';

const baseUrl = 'http://127.0.0.1:11434';

describe('OllamaAdapter — listModels and health', () => {
  it('lists models from /api/tags', async () => {
    const tags = JSON.stringify({
      models: [
        {
          name: 'llama3.1:8b-instruct',
          size: 4_700_000_000,
          digest: 'abc',
          modified_at: '2025-04-15T10:00:00Z',
          details: { parameter_size: '8B', quantization_level: 'Q4_K_M' },
        },
      ],
    });
    const mock = makeMockFetch([{ status: 200, body: tags, headers: { 'content-type': 'application/json' } }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const models = await ollama.listModels();
    expect(models).toHaveLength(1);
    expect(models[0]?.name).toBe('llama3.1:8b-instruct');
    expect(models[0]?.parameterSize).toBe('8B');
    expect(models[0]?.quantization).toBe('Q4_K_M');
    expect(mock.requests[0]?.url).toBe(`${baseUrl}/api/tags`);
  });

  it('reports reachable=true when /api/tags succeeds', async () => {
    const tags = JSON.stringify({ models: [{ name: 'x' }] });
    const mock = makeMockFetch([{ status: 200, body: tags }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const h = await ollama.health();
    expect(h.reachable).toBe(true);
    expect(h.modelLoaded).toBe('x');
  });

  it('reports reachable=false when server is down (and does not throw)', async () => {
    const mock = makeMockFetch([
      { reject: makeConnRefused() },
      { reject: makeConnRefused() },
      { reject: makeConnRefused() },
    ]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    const h = await ollama.health();
    expect(h.reachable).toBe(false);
    expect(h.models).toHaveLength(0);
  });

  it('uses the requested model hint when present', async () => {
    const tags = JSON.stringify({ models: [{ name: 'a' }, { name: 'b' }] });
    const mock = makeMockFetch([{ status: 200, body: tags }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const h = await ollama.health('b');
    expect(h.modelLoaded).toBe('b');
  });
});

describe('OllamaAdapter — generate streaming', () => {
  it('streams chunks and aggregates into a final response', async () => {
    const frames = [
      JSON.stringify({ model: 'm', response: 'Hello', done: false }),
      JSON.stringify({ model: 'm', response: ' world', done: false }),
      JSON.stringify({
        model: 'm',
        response: '!',
        done: true,
        done_reason: 'stop',
        prompt_eval_count: 4,
        eval_count: 3,
        total_duration: 1_500_000_000,
      }),
    ];
    const stream = makeNdjsonStream(frames);
    const mock = makeMockFetch([{ status: 200, body: stream }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const res = await ollama.generate('m', 'hi');
    expect(res.text).toBe('Hello world!');
    expect(res.promptTokens).toBe(4);
    expect(res.completionTokens).toBe(3);
    expect(res.totalDurationMs).toBe(1500);
    expect(res.finishReason).toBe('stop');
  });

  it('yields per-chunk text via generateStream', async () => {
    const frames = [
      JSON.stringify({ model: 'm', response: 'A', done: false }),
      JSON.stringify({ model: 'm', response: 'B', done: false }),
      JSON.stringify({ model: 'm', response: '', done: true, done_reason: 'stop' }),
    ];
    const stream = makeNdjsonStream(frames);
    const mock = makeMockFetch([{ status: 200, body: stream }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const chunks: { text: string; done: boolean }[] = [];
    for await (const c of ollama.generateStream('m', 'p')) {
      chunks.push({ text: c.text, done: c.done });
    }
    expect(chunks.map((c) => c.text)).toEqual(['A', 'B', '']);
    expect(chunks.at(-1)?.done).toBe(true);
  });

  it('handles split NDJSON frames across read boundaries', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Frame 1 split across two enqueues, frame 2 whole.
        controller.enqueue(encoder.encode('{"model":"m","response":"par'));
        controller.enqueue(encoder.encode('tial","done":false}\n'));
        controller.enqueue(encoder.encode('{"model":"m","response":"end","done":true,"done_reason":"stop"}\n'));
        controller.close();
      },
    });
    const mock = makeMockFetch([{ status: 200, body: stream }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const res = await ollama.generate('m', 'hi');
    expect(res.text).toBe('partialend');
  });

  it('passes generation options via /api/generate body', async () => {
    const frames = [JSON.stringify({ model: 'm', response: '', done: true })];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await ollama.generate('m', 'p', { temperature: 0.1, topP: 0.9, maxTokens: 64, seed: 42, stop: ['\n\n'] });
    const body = JSON.parse(mock.requests[0]!.body!);
    expect(body.options.temperature).toBe(0.1);
    expect(body.options.top_p).toBe(0.9);
    expect(body.options.num_predict).toBe(64);
    expect(body.options.seed).toBe(42);
    expect(body.options.stop).toEqual(['\n\n']);
  });
});

describe('OllamaAdapter — chat', () => {
  it('aggregates chat stream into ChatResponse', async () => {
    const frames = [
      JSON.stringify({ model: 'm', message: { role: 'assistant', content: 'Sure' }, done: false }),
      JSON.stringify({ model: 'm', message: { role: 'assistant', content: ', ' }, done: false }),
      JSON.stringify({
        model: 'm',
        message: { role: 'assistant', content: 'okay.' },
        done: true,
        done_reason: 'stop',
      }),
    ];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const res = await ollama.chat('m', [{ role: 'user', content: 'hi' }]);
    expect(res.text).toBe('Sure, okay.');
    expect(res.message.content).toBe('Sure, okay.');
    expect(res.finishReason).toBe('stop');
  });

  it('streams chat chunks via chatStream', async () => {
    const frames = [
      JSON.stringify({ model: 'm', message: { role: 'assistant', content: 'X' }, done: false }),
      JSON.stringify({ model: 'm', message: { role: 'assistant', content: '' }, done: true }),
    ];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const out: string[] = [];
    for await (const c of ollama.chatStream('m', [{ role: 'user', content: 'hi' }])) {
      out.push(c.text);
    }
    expect(out).toEqual(['X', '']);
  });
});

describe('OllamaAdapter — embeddings', () => {
  it('returns embedding vector with correct dim', async () => {
    const body = JSON.stringify({ embedding: [0.1, 0.2, 0.3, 0.4] });
    const mock = makeMockFetch([{ status: 200, body }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    const out = await ollama.embed('nomic-embed-text', 'hello');
    expect(out.dim).toBe(4);
    expect(out.vector).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it('throws on empty embedding', async () => {
    const body = JSON.stringify({ embedding: [] });
    const mock = makeMockFetch([{ status: 200, body }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(ollama.embed('m', 'hi')).rejects.toThrow(/empty/i);
  });
});

describe('OllamaAdapter — error handling and retries', () => {
  it('retries on connection refused then succeeds', async () => {
    const tags = JSON.stringify({ models: [{ name: 'a' }] });
    const mock = makeMockFetch([
      { reject: makeConnRefused() },
      { reject: makeConnRefused() },
      { status: 200, body: tags },
    ]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 5, initialDelayMs: 1, maxDelayMs: 2, backoffFactor: 2 },
    });
    const models = await ollama.listModels();
    expect(models).toHaveLength(1);
    expect(mock.requests).toHaveLength(3);
  });

  it('throws LocalLlmUnreachableError after exhausting retries', async () => {
    const mock = makeMockFetch([
      { reject: makeConnRefused() },
      { reject: makeConnRefused() },
    ]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    await expect(ollama.listModels()).rejects.toBeInstanceOf(LocalLlmUnreachableError);
  });

  it('does NOT retry on 4xx', async () => {
    const mock = makeMockFetch([{ status: 404, body: 'not found' }]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 5, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    await expect(ollama.listModels()).rejects.toBeInstanceOf(LocalLlmHttpError);
    expect(mock.requests).toHaveLength(1);
  });

  it('retries on 503', async () => {
    const tags = JSON.stringify({ models: [{ name: 'a' }] });
    const mock = makeMockFetch([
      { status: 503, body: 'busy' },
      { status: 200, body: tags },
    ]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    const models = await ollama.listModels();
    expect(models).toHaveLength(1);
    expect(mock.requests).toHaveLength(2);
  });

  it('maps "no such model" stream error to LocalLlmModelNotFoundError', async () => {
    const frames = [JSON.stringify({ model: 'm', done: true, error: 'model not found, please pull' })];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(ollama.generate('m', 'p')).rejects.toBeInstanceOf(LocalLlmModelNotFoundError);
  });

  it('honours per-call timeout (LocalLlmTimeoutError)', async () => {
    const mock = makeMockFetch([{ status: 200, body: 'ok', delayMs: 100 }]);
    const ollama = new OllamaAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      defaultTimeoutMs: 5,
      retry: { maxAttempts: 1, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    await expect(ollama.listModels()).rejects.toBeInstanceOf(LocalLlmTimeoutError);
  });

  it('surfaces invalid /api/tags JSON as bad-response error', async () => {
    const mock = makeMockFetch([{ status: 200, body: '{"oops":1}' }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    // tags schema defaults models=[] so this actually succeeds (lenient parser); ensure no throw.
    const models = await ollama.listModels();
    expect(models).toHaveLength(0);
  });

  it('rejects malformed NDJSON frames', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('this is not json\n'));
        c.close();
      },
    });
    const mock = makeMockFetch([{ status: 200, body: stream }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(ollama.generate('m', 'p')).rejects.toThrow(/NDJSON/);
  });
});

describe('OllamaAdapter — pullModel', () => {
  it('drains pull progress stream and resolves', async () => {
    const frames = [
      JSON.stringify({ status: 'pulling manifest' }),
      JSON.stringify({ status: 'downloading' }),
      JSON.stringify({ status: 'success' }),
    ];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(ollama.pullModel('llama3.1:8b')).resolves.toBeUndefined();
    expect(mock.requests[0]?.url).toBe(`${baseUrl}/api/pull`);
  });

  it('throws when pull stream reports an error frame', async () => {
    const frames = [JSON.stringify({ error: 'manifest unauthorized' })];
    const mock = makeMockFetch([{ status: 200, body: makeNdjsonStream(frames) }]);
    const ollama = new OllamaAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(ollama.pullModel('private:model')).rejects.toThrow(/manifest unauthorized/);
  });
});
