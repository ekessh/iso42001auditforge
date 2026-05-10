// SPDX-License-Identifier: BUSL-1.1
import type {
  DiarizationProvider,
  DiarizeInput,
  DiarizeOptions,
  SpeakerSegment,
} from '../types.js';

export class StubDiarizationProvider implements DiarizationProvider {
  public readonly name = 'stub';

  constructor(private readonly numSpeakers = 2) {
    if (this.numSpeakers < 1) throw new Error('numSpeakers must be >= 1');
  }

  async *diarize(
    input: DiarizeInput,
    opts?: DiarizeOptions,
  ): AsyncIterable<SpeakerSegment> {
    if (input.kind !== 'transcript') {
      yield {
        startMs: 0,
        endMs: 1,
        speakerId: this.label(0),
        confidence: 0.5,
      };
      return;
    }
    let i = 0;
    for (const seg of input.segments) {
      if (opts?.signal?.aborted) return;
      const speakerId = this.label(i % (opts?.numSpeakersHint ?? this.numSpeakers));
      i += 1;
      yield {
        startMs: seg.startMs,
        endMs: seg.endMs,
        speakerId,
        confidence: 0.8,
      };
    }
  }

  private label(i: number): string {
    return `SPK-${String.fromCharCode(65 + (i % 26))}`;
  }
}
