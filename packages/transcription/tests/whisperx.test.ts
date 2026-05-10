// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { WhisperXProvider } from '../src/providers/whisperx.js';
import { TranscriptionError, type AudioSource } from '../src/types.js';

const audio: AudioSource = {
  kind: 'buffer',
  data: new Uint8Array([0]),
  mimeType: 'audio/webm',
};

const validSeg = {
  id: 'seg-a',
  startMs: 0,
  endMs: 1_000,
  text: 'hello',
  words: [{ text: 'hello', startMs: 0, endMs: 500, confidence: 0.9 }],
  confidence: 0.9,
  isFinal: true,
};

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('WhisperXProvider', () => {
  it('parses sidecar JSON segments', async () => {
    const p = new WhisperXProvider({
      endpoint: 'http://sidecar/',
      fetchImpl: fakeFetch({ segments: [validSeg] }),
    });
    const got: unknown[] = [];
    for await (const s of p.transcribe(audio)) got.push(s);
    expect(got).toHaveLength(1);
  });

  it('throws on schema-invalid response', async () => {
    const p = new WhisperXProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({ segments: [{ id: 'x' }] }),
    });
    await expect(async () => {
      for await (const _ of p.transcribe(audio)) void _;
    }).rejects.toBeInstanceOf(TranscriptionError);
  });

  it('throws on HTTP error', async () => {
    const p = new WhisperXProvider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({ segments: [] }, 500),
    });
    await expect(async () => {
      for await (const _ of p.transcribe(audio)) void _;
    }).rejects.toBeInstanceOf(TranscriptionError);
  });

  it('throws when fetch is unavailable', async () => {
    const p = new WhisperXProvider({
      endpoint: 'http://sidecar',
      fetchImpl: undefined as unknown as typeof fetch,
    });
    const orig = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    try {
      await expect(async () => {
        for await (const _ of p.transcribe(audio)) void _;
      }).rejects.toBeInstanceOf(TranscriptionError);
    } finally {
      globalThis.fetch = orig;
    }
  });

  it('wraps network errors with NETWORK code', async () => {
    const fetcher = (() => Promise.reject(new Error('econn'))) as unknown as typeof fetch;
    const p = new WhisperXProvider({ endpoint: 'http://sidecar', fetchImpl: fetcher });
    await expect(async () => {
      for await (const _ of p.transcribe(audio)) void _;
    }).rejects.toBeInstanceOf(TranscriptionError);
  });

  it('forwards apiKey + language headers', async () => {
    let received: HeadersInit | undefined;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      received = init?.headers;
      return new Response(JSON.stringify({ segments: [validSeg] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new WhisperXProvider({
      endpoint: 'http://sidecar',
      apiKey: 'k',
      fetchImpl: fetcher,
    });
    for await (const _ of p.transcribe(audio, { language: 'en' })) void _;
    const h = received as Record<string, string>;
    expect(h['authorization']).toBe('Bearer k');
    expect(h['x-language']).toBe('en');
  });

  it('materializes streaming chunks into a single buffer', async () => {
    let received: BodyInit | null = null;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      received = init?.body ?? null;
      return new Response(JSON.stringify({ segments: [validSeg] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new WhisperXProvider({ endpoint: 'http://sidecar', fetchImpl: fetcher });
    async function* chunks(): AsyncIterable<Uint8Array> {
      yield new Uint8Array([1, 2]);
      yield new Uint8Array([3]);
    }
    for await (const _ of p.transcribe({
      kind: 'stream',
      chunks: chunks(),
      mimeType: 'audio/webm',
    })) {
      void _;
    }
    expect(received).not.toBeNull();
    expect(received).toBeInstanceOf(Uint8Array);
    const buf = received as unknown as Uint8Array;
    expect(buf).toEqual(new Uint8Array([1, 2, 3]));
  });
});
