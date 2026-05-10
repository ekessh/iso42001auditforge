// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import type { TranscriptSegment } from '@auditforge/transcription';
import { mergeWithTranscript } from '../src/merge.js';
import type { SpeakerSegment } from '../src/types.js';

const t1: TranscriptSegment = {
  id: 'seg-1',
  startMs: 0,
  endMs: 1_000,
  text: 'hello world',
  isFinal: true,
  confidence: 0.9,
  words: [
    { text: 'hello', startMs: 0, endMs: 400, confidence: 0.9 },
    { text: 'world', startMs: 500, endMs: 900, confidence: 0.9 },
  ],
};

describe('mergeWithTranscript', () => {
  it('attaches a speaker to each word using best-overlap', () => {
    const speakers: SpeakerSegment[] = [
      { startMs: 0, endMs: 450, speakerId: 'SPK-A' },
      { startMs: 450, endMs: 1_000, speakerId: 'SPK-B' },
    ];
    const merged = mergeWithTranscript([t1], speakers);
    expect(merged[0]?.words[0]?.speakerId).toBe('SPK-A');
    expect(merged[0]?.words[1]?.speakerId).toBe('SPK-B');
  });

  it('does not leak across segment boundaries', () => {
    const speakers: SpeakerSegment[] = [
      { startMs: 0, endMs: 500, speakerId: 'SPK-A' },
      { startMs: 500, endMs: 1_000, speakerId: 'SPK-B' },
    ];
    const merged = mergeWithTranscript([t1], speakers);
    expect(merged[0]?.words[0]?.speakerId).not.toBe(merged[0]?.words[1]?.speakerId);
  });

  it('falls back to UNKNOWN when no speaker overlaps', () => {
    const speakers: SpeakerSegment[] = [
      { startMs: 5_000, endMs: 6_000, speakerId: 'SPK-A' },
    ];
    const merged = mergeWithTranscript([t1], speakers);
    for (const w of merged[0]?.words ?? []) {
      expect(w.speakerId).toBe('SPK-UNKNOWN');
    }
    expect(merged[0]?.speakerId).toBe('SPK-UNKNOWN');
  });

  it('picks dominant speaker for the segment', () => {
    const speakers: SpeakerSegment[] = [
      { startMs: 0, endMs: 100, speakerId: 'SPK-A' },
      { startMs: 100, endMs: 1_000, speakerId: 'SPK-B' },
    ];
    const merged = mergeWithTranscript(
      [
        {
          ...t1,
          words: [
            { text: 'a', startMs: 0, endMs: 90, confidence: 0.9 },
            { text: 'b', startMs: 200, endMs: 400, confidence: 0.9 },
            { text: 'c', startMs: 500, endMs: 800, confidence: 0.9 },
          ],
        },
      ],
      speakers,
    );
    expect(merged[0]?.speakerId).toBe('SPK-B');
  });

  it('handles word-less segments by labeling at segment level', () => {
    const noWords: TranscriptSegment = {
      ...t1,
      words: [],
    };
    const merged = mergeWithTranscript([noWords], [
      { startMs: 0, endMs: 1_000, speakerId: 'SPK-Z' },
    ]);
    expect(merged[0]?.speakerId).toBe('SPK-Z');
  });
});
