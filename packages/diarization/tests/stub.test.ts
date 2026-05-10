// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { StubDiarizationProvider } from '../src/providers/stub.js';

describe('StubDiarizationProvider', () => {
  it('round-robins between speakers', async () => {
    const p = new StubDiarizationProvider(2);
    const ids: string[] = [];
    const segments = [
      { startMs: 0, endMs: 100 },
      { startMs: 100, endMs: 200 },
      { startMs: 200, endMs: 300 },
      { startMs: 300, endMs: 400 },
    ];
    for await (const s of p.diarize({ kind: 'transcript', segments })) ids.push(s.speakerId);
    expect(ids).toEqual(['SPK-A', 'SPK-B', 'SPK-A', 'SPK-B']);
  });

  it('respects numSpeakersHint override', async () => {
    const p = new StubDiarizationProvider(2);
    const ids: string[] = [];
    const segments = [
      { startMs: 0, endMs: 1 },
      { startMs: 1, endMs: 2 },
      { startMs: 2, endMs: 3 },
    ];
    for await (const s of p.diarize(
      { kind: 'transcript', segments },
      { numSpeakersHint: 3 },
    )) ids.push(s.speakerId);
    expect(new Set(ids).size).toBe(3);
  });

  it('aborts cleanly on signal', async () => {
    const p = new StubDiarizationProvider(2);
    const ac = new AbortController();
    ac.abort();
    const got: unknown[] = [];
    for await (const s of p.diarize(
      { kind: 'transcript', segments: [{ startMs: 0, endMs: 1 }] },
      { signal: ac.signal },
    )) got.push(s);
    expect(got).toHaveLength(0);
  });

  it('rejects numSpeakers < 1', () => {
    expect(() => new StubDiarizationProvider(0)).toThrow();
  });

  it('falls back to a single speaker for raw audio', async () => {
    const p = new StubDiarizationProvider(2);
    const got: unknown[] = [];
    for await (const s of p.diarize({
      kind: 'audio',
      data: new Uint8Array([1, 2]),
      mimeType: 'audio/webm',
    })) got.push(s);
    expect(got).toHaveLength(1);
  });
});
