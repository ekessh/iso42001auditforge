// SPDX-License-Identifier: BUSL-1.1
import type {
  TranscriptSegment,
  TranscriptWord,
} from '@auditforge/transcription';
import type { SpeakerSegment } from './types.js';

export interface LabeledWord extends TranscriptWord {
  readonly speakerId: string;
}

export interface LabeledTranscript {
  readonly id: string;
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly speakerId: string;
  readonly confidence: number;
  readonly words: readonly LabeledWord[];
  readonly isFinal: boolean;
  readonly language?: string;
}

const UNKNOWN_SPEAKER = 'SPK-UNKNOWN';

export function mergeWithTranscript(
  transcriptSegments: readonly TranscriptSegment[],
  speakerSegments: readonly SpeakerSegment[],
): LabeledTranscript[] {
  const out: LabeledTranscript[] = [];
  const speakers = [...speakerSegments].sort((a, b) => a.startMs - b.startMs);
  for (const t of transcriptSegments) {
    const labeledWords: LabeledWord[] = [];
    let segCounts = new Map<string, number>();
    for (const w of t.words) {
      const speaker = pickSpeaker(speakers, w.startMs, w.endMs) ?? UNKNOWN_SPEAKER;
      labeledWords.push({ ...w, speakerId: speaker });
      segCounts.set(speaker, (segCounts.get(speaker) ?? 0) + 1);
    }
    let dominant: string;
    if (labeledWords.length === 0) {
      dominant = pickSpeaker(speakers, t.startMs, t.endMs) ?? UNKNOWN_SPEAKER;
      segCounts = new Map([[dominant, 1]]);
    } else {
      dominant = pickDominant(segCounts);
    }
    out.push({
      id: t.id,
      startMs: t.startMs,
      endMs: t.endMs,
      text: t.text,
      confidence: t.confidence,
      isFinal: t.isFinal,
      speakerId: dominant,
      words: labeledWords,
      ...(t.language !== undefined ? { language: t.language } : {}),
    });
  }
  return out;
}

function pickSpeaker(
  speakers: readonly SpeakerSegment[],
  startMs: number,
  endMs: number,
): string | null {
  let bestId: string | null = null;
  let bestOverlap = 0;
  for (const s of speakers) {
    if (s.endMs <= startMs) continue;
    if (s.startMs >= endMs) break;
    const overlap = Math.min(s.endMs, endMs) - Math.max(s.startMs, startMs);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestId = s.speakerId;
    }
  }
  return bestOverlap > 0 ? bestId : null;
}

function pickDominant(counts: ReadonlyMap<string, number>): string {
  let best: string = UNKNOWN_SPEAKER;
  let bestN = -1;
  for (const [k, v] of counts) {
    if (v > bestN) {
      bestN = v;
      best = k;
    }
  }
  return best;
}
