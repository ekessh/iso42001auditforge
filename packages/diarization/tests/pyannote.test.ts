// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { Pyannote31Provider } from '../src/providers/pyannote.js';
import { DiarizationError, type DiarizeInput } from '../src/types.js';

const valid = {
  startMs: 0,
  endMs: 100,
  speakerId: 'SPK-A',
  confidence: 0.9,
};

function fakeFetch(payload: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('Pyannote31Provider', () => {
  it('parses sidecar segments from transcript input', async () => {
    const p = new Pyannote31Provider({
      endpoint: 'http://sidecar/',
      fetchImpl: fakeFetch({ segments: [valid] }),
    });
    const got: unknown[] = [];
    for await (const s of p.diarize({
      kind: 'transcript',
      segments: [{ startMs: 0, endMs: 100 }],
    })) got.push(s);
    expect(got).toHaveLength(1);
  });

  it('encodes audio bytes to base64 and forwards num_speakers', async () => {
    let body: BodyInit | null = null;
    const fetcher = (async (_url: string, init?: RequestInit) => {
      body = init?.body ?? null;
      return new Response(JSON.stringify({ segments: [valid] }), { status: 200 });
    }) as unknown as typeof fetch;
    const p = new Pyannote31Provider({
      endpoint: 'http://sidecar',
      apiKey: 'k',
      fetchImpl: fetcher,
    });
    const input: DiarizeInput = {
      kind: 'audio',
      data: new Uint8Array([1, 2, 3]),
      mimeType: 'audio/webm',
    };
    for await (const _ of p.diarize(input, { numSpeakersHint: 3 })) void _;
    const parsed = JSON.parse(body as unknown as string) as Record<string, unknown>;
    expect(parsed['audio_b64']).toBeTypeOf('string');
    expect(parsed['num_speakers']).toBe(3);
  });

  it('throws SCHEMA on invalid sidecar payload', async () => {
    const p = new Pyannote31Provider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({ segments: [{ startMs: 0 }] }),
    });
    await expect(async () => {
      for await (const _ of p.diarize({
        kind: 'transcript',
        segments: [{ startMs: 0, endMs: 100 }],
      })) void _;
    }).rejects.toBeInstanceOf(DiarizationError);
  });

  it('throws HTTP_ERROR on non-200', async () => {
    const p = new Pyannote31Provider({
      endpoint: 'http://sidecar',
      fetchImpl: fakeFetch({}, 500),
    });
    await expect(async () => {
      for await (const _ of p.diarize({
        kind: 'transcript',
        segments: [{ startMs: 0, endMs: 100 }],
      })) void _;
    }).rejects.toBeInstanceOf(DiarizationError);
  });

  it('wraps network errors with NETWORK code', async () => {
    const fetcher = (() => Promise.reject(new Error('econn'))) as unknown as typeof fetch;
    const p = new Pyannote31Provider({ endpoint: 'http://sidecar', fetchImpl: fetcher });
    await expect(async () => {
      for await (const _ of p.diarize({
        kind: 'transcript',
        segments: [{ startMs: 0, endMs: 100 }],
      })) void _;
    }).rejects.toBeInstanceOf(DiarizationError);
  });

  it('throws when fetch is unavailable', async () => {
    const orig = globalThis.fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    try {
      const p = new Pyannote31Provider({
        endpoint: 'http://sidecar',
        fetchImpl: undefined as unknown as typeof fetch,
      });
      await expect(async () => {
        for await (const _ of p.diarize({
          kind: 'transcript',
          segments: [{ startMs: 0, endMs: 1 }],
        })) void _;
      }).rejects.toBeInstanceOf(DiarizationError);
    } finally {
      globalThis.fetch = orig;
    }
  });
});
