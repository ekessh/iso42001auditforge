// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { StubTranscriptionProvider } from '../src/providers/stub.js';
import type { AudioSource } from '../src/types.js';

const fakeAudio: AudioSource = {
  kind: 'buffer',
  data: new Uint8Array([1, 2, 3]),
  mimeType: 'audio/webm',
};

describe('StubTranscriptionProvider', () => {
  it('emits canned segments in order', async () => {
    const p = new StubTranscriptionProvider();
    const got: number[] = [];
    for await (const s of p.transcribe(fakeAudio)) got.push(s.startMs);
    expect(got).toEqual([0, 2_500]);
  });

  it('passes through confidence', async () => {
    const p = new StubTranscriptionProvider();
    for await (const s of p.transcribe(fakeAudio)) {
      expect(s.confidence).toBeGreaterThanOrEqual(0.9);
      expect(s.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('respects abort signal', async () => {
    const p = new StubTranscriptionProvider();
    const ac = new AbortController();
    ac.abort();
    const got: unknown[] = [];
    for await (const s of p.transcribe(fakeAudio, { signal: ac.signal })) got.push(s);
    expect(got).toHaveLength(0);
  });

  it('rejects unordered scripts at construction', () => {
    expect(
      () =>
        new StubTranscriptionProvider({
          segments: [
            {
              id: 's1',
              startMs: 200,
              endMs: 300,
              text: 'b',
              words: [],
              confidence: 0.9,
              isFinal: true,
            },
            {
              id: 's0',
              startMs: 0,
              endMs: 100,
              text: 'a',
              words: [],
              confidence: 0.9,
              isFinal: true,
            },
          ],
        }),
    ).toThrow();
  });

  it('rejects scripts with end before start', () => {
    expect(
      () =>
        new StubTranscriptionProvider({
          segments: [
            {
              id: 's',
              startMs: 100,
              endMs: 50,
              text: 'x',
              words: [],
              confidence: 0.9,
              isFinal: true,
            },
          ],
        }),
    ).toThrow();
  });
});
