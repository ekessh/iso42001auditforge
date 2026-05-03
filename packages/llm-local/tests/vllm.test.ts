// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { LocalLlmHttpError, VllmAdapter } from '../src/index.js';
import { makeMockFetch, makeSseStream } from './helpers.js';

const baseUrl = 'http://127.0.0.1:8000';

describe('VllmAdapter — listModels', () => {
  it('parses OpenAI-style /v1/models', async () => {
    const body = JSON.stringify({ data: [{ id: 'mistral-7b' }, { id: 'phi-3' }] });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const models = await v.listModels();
    expect(models.map((m) => m.name)).toEqual(['mistral-7b', 'phi-3']);
  });

  it('attaches Bearer auth header when apiKey set', async () => {
    const body = JSON.stringify({ data: [] });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch, apiKey: 'sk-vllm-x' });
    await v.listModels();
    expect(mock.requests[0]?.headers.authorization).toBe('Bearer sk-vllm-x');
  });
});

describe('VllmAdapter — generate (non-streaming)', () => {
  it('returns aggregated text from /v1/completions', async () => {
    const body = JSON.stringify({
      model: 'mistral-7b',
      choices: [{ text: 'Hello world', finish_reason: 'stop' }],
      usage: { prompt_tokens: 4, completion_tokens: 2 },
    });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const out = await v.generate('mistral-7b', 'hi');
    expect(out.text).toBe('Hello world');
    expect(out.promptTokens).toBe(4);
    expect(out.completionTokens).toBe(2);
    expect(out.finishReason).toBe('stop');
  });

  it('errors on missing choices', async () => {
    const body = JSON.stringify({ model: 'm', choices: [] });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    await expect(v.generate('m', 'p')).rejects.toThrow(/no choices/);
  });
});

describe('VllmAdapter — generateStream (SSE)', () => {
  it('emits text deltas then a [DONE] terminator', async () => {
    const events = [
      JSON.stringify({ choices: [{ text: 'A' }] }),
      JSON.stringify({ choices: [{ text: 'B' }] }),
      JSON.stringify({ choices: [{ text: '', finish_reason: 'stop' }] }),
      '[DONE]',
    ];
    const mock = makeMockFetch([{ status: 200, body: makeSseStream(events) }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const got: { text: string; done: boolean }[] = [];
    for await (const c of v.generateStream('m', 'p')) {
      got.push({ text: c.text, done: c.done });
    }
    expect(got.map((x) => x.text)).toEqual(['A', 'B', '', '']);
    expect(got.at(-1)?.done).toBe(true);
  });
});

describe('VllmAdapter — chat', () => {
  it('returns a ChatResponse from /v1/chat/completions', async () => {
    const body = JSON.stringify({
      model: 'm',
      choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
    });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const out = await v.chat('m', [{ role: 'user', content: 'hi' }]);
    expect(out.message.content).toBe('OK');
  });

  it('streams chat deltas (delta.content)', async () => {
    const events = [
      JSON.stringify({ choices: [{ delta: { content: 'X' } }] }),
      JSON.stringify({ choices: [{ delta: { content: 'Y' } }] }),
      JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }] }),
      '[DONE]',
    ];
    const mock = makeMockFetch([{ status: 200, body: makeSseStream(events) }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const got: string[] = [];
    for await (const c of v.chatStream('m', [{ role: 'user', content: 'hi' }])) got.push(c.text);
    expect(got).toEqual(['X', 'Y', '', '']);
  });
});

describe('VllmAdapter — embed', () => {
  it('returns vector', async () => {
    const body = JSON.stringify({
      model: 'm',
      data: [{ embedding: [1, 2, 3] }],
    });
    const mock = makeMockFetch([{ status: 200, body }]);
    const v = new VllmAdapter({ baseUrl, fetchImpl: mock.fetch });
    const out = await v.embed('m', 'x');
    expect(out.vector).toEqual([1, 2, 3]);
    expect(out.dim).toBe(3);
  });
});

describe('VllmAdapter — pullModel + errors', () => {
  it('pullModel is a no-op (vLLM loads at startup)', async () => {
    const v = new VllmAdapter({ baseUrl, fetchImpl: makeMockFetch([]).fetch });
    await expect(v.pullModel('whatever')).resolves.toBeUndefined();
  });

  it('surfaces 4xx as LocalLlmHttpError', async () => {
    const mock = makeMockFetch([{ status: 422, body: 'unprocessable' }]);
    const v = new VllmAdapter({
      baseUrl,
      fetchImpl: mock.fetch,
      retry: { maxAttempts: 2, initialDelayMs: 1, maxDelayMs: 1, backoffFactor: 1 },
    });
    await expect(v.listModels()).rejects.toBeInstanceOf(LocalLlmHttpError);
  });
});

describe('factory createLocalLlm', () => {
  it('builds an Ollama instance', async () => {
    const { createLocalLlm } = await import('../src/index.js');
    const a = createLocalLlm({ kind: 'ollama', baseUrl });
    expect(a.kind).toBe('ollama');
  });

  it('builds a vLLM instance', async () => {
    const { createLocalLlm } = await import('../src/index.js');
    const a = createLocalLlm({ kind: 'vllm', baseUrl });
    expect(a.kind).toBe('vllm');
  });
});
