// SPDX-License-Identifier: BUSL-1.1
import type {
  AudioSource,
  TranscribeOptions,
  TranscriptSegment,
  TranscriptionProvider,
} from '../types.js';

export interface StubScript {
  readonly segments: readonly TranscriptSegment[];
}

const DEFAULT_SCRIPT: StubScript = {
  segments: [
    {
      id: 'seg-1',
      startMs: 0,
      endMs: 2_400,
      text: 'We document our AIMS scope in the SoA.',
      confidence: 0.95,
      isFinal: true,
      words: [
        { text: 'We', startMs: 0, endMs: 200, confidence: 0.96 },
        { text: 'document', startMs: 200, endMs: 700, confidence: 0.95 },
        { text: 'our', startMs: 700, endMs: 900, confidence: 0.97 },
        { text: 'AIMS', startMs: 900, endMs: 1_300, confidence: 0.93 },
        { text: 'scope', startMs: 1_300, endMs: 1_700, confidence: 0.95 },
        { text: 'in', startMs: 1_700, endMs: 1_900, confidence: 0.98 },
        { text: 'the', startMs: 1_900, endMs: 2_050, confidence: 0.97 },
        { text: 'SoA.', startMs: 2_050, endMs: 2_400, confidence: 0.95 },
      ],
    },
    {
      id: 'seg-2',
      startMs: 2_500,
      endMs: 5_000,
      text: 'The risk register is reviewed quarterly.',
      confidence: 0.91,
      isFinal: true,
      words: [
        { text: 'The', startMs: 2_500, endMs: 2_700, confidence: 0.95 },
        { text: 'risk', startMs: 2_700, endMs: 3_000, confidence: 0.94 },
        { text: 'register', startMs: 3_000, endMs: 3_500, confidence: 0.92 },
        { text: 'is', startMs: 3_500, endMs: 3_650, confidence: 0.97 },
        { text: 'reviewed', startMs: 3_650, endMs: 4_200, confidence: 0.9 },
        { text: 'quarterly.', startMs: 4_200, endMs: 5_000, confidence: 0.85 },
      ],
    },
  ],
};

export class StubTranscriptionProvider implements TranscriptionProvider {
  public readonly name = 'stub';
  private readonly script: StubScript;

  constructor(script?: StubScript) {
    this.script = script ?? DEFAULT_SCRIPT;
    this.validateOrdering(this.script);
  }

  async *transcribe(
    audio: AudioSource,
    opts?: TranscribeOptions,
  ): AsyncIterable<TranscriptSegment> {
    void audio;
    for (const seg of this.script.segments) {
      if (opts?.signal?.aborted) return;
      yield seg;
    }
  }

  private validateOrdering(script: StubScript): void {
    let last = -1;
    for (const s of script.segments) {
      if (s.startMs < last) {
        throw new Error(`stub script segments must be ordered: ${s.id}`);
      }
      if (s.endMs < s.startMs) {
        throw new Error(`stub script segment endMs < startMs: ${s.id}`);
      }
      last = s.startMs;
    }
  }
}
