// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { ModelCardSchema } from '../src/schemas.js';
import { QwenVlProvider } from '../src/providers/qwen.js';
import { DeepSeekOcrProvider } from '../src/providers/deepseek.js';
import { VlmExtractionError } from '../src/types.js';

const okBody = {
  value: {
    modelName: 'X',
    modelVersion: '1.0',
    knownLimitations: [],
    performanceMetrics: [],
  },
  confidence: 0.9,
  sourceRegions: [{ x: 0, y: 0, width: 1, height: 1 }],
  modelName: 'qwen2.5-vl',
  modelHash: 'sha256:hash',
};

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), { status })) as unknown as typeof fetch;
}

describe('QwenVlProvider', () => {
  it('extracts via sidecar and validates against schema', async () => {
    const p = new QwenVlProvider({
      endpoint: 'http://sidecar/',
      fetchImpl: fakeFetch(okBody),
    });
    const out = await p.extract(new Uint8Array([1]), ModelCardSchema, {
      schemaId: 'ModelCard',
    });
    expect(out.modelName).toBe('qwen2.5-vl');
    expect(out.confidence).toBe(0.9);
  });

  it('rejects when sidecar returns malformed value', async () => {
    const p = new QwenVlProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({ ...okBody, value: { modelName: 1 } }),
    });
    await expect(
      p.extract(new Uint8Array([1]), ModelCardSchema, { schemaId: 'ModelCard' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('throws on HTTP error', async () => {
    const p = new QwenVlProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({}, 503),
    });
    await expect(
      p.extract(new Uint8Array([1]), ModelCardSchema, { schemaId: 'ModelCard' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('wraps network failures', async () => {
    const fetcher = (() => Promise.reject(new Error('econn'))) as unknown as typeof fetch;
    const p = new QwenVlProvider({ endpoint: 'http://sidecar', fetchImpl: fetcher });
    await expect(
      p.extract(new Uint8Array([1]), ModelCardSchema, { schemaId: 'ModelCard' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('forwards apiKey when provided', async () => {
    let received: HeadersInit | undefined;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      received = init?.headers;
      return new Response(JSON.stringify(okBody));
    }) as unknown as typeof fetch;
    const p = new QwenVlProvider({
      endpoint: 'http://sidecar',
      apiKey: 'k',
      fetchImpl: fetcher,
    });
    await p.extract(new Uint8Array([1]), ModelCardSchema, { schemaId: 'ModelCard' });
    expect((received as Record<string, string>)['authorization']).toBe('Bearer k');
  });

  it('throws when fetch is unavailable', async () => {
    const orig = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    try {
      const p = new QwenVlProvider({
        endpoint: 'http://sidecar',
        fetchImpl: undefined as unknown as typeof fetch,
      });
      await expect(
        p.extract(new Uint8Array([1]), ModelCardSchema, { schemaId: 'ModelCard' }),
      ).rejects.toBeInstanceOf(VlmExtractionError);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('skips redaction when redactPii=false', async () => {
    const p = new QwenVlProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({
        ...okBody,
        value: { ...okBody.value, intendedUse: 'a@b.com' },
      }),
    });
    const out = await p.extract(new Uint8Array([1]), ModelCardSchema, {
      schemaId: 'ModelCard',
      redactPii: false,
    });
    expect(out.value.intendedUse).toBe('a@b.com');
  });
});

describe('DeepSeekOcrProvider', () => {
  it('shares the sidecar driver and extracts', async () => {
    const p = new DeepSeekOcrProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch(okBody),
    });
    const out = await p.extract(new Uint8Array([1]), ModelCardSchema, {
      schemaId: 'ModelCard',
    });
    expect(out.modelName).toBe('qwen2.5-vl');
  });
});
