// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const SpeakerSegmentSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    speakerId: z.string().min(1),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();
export type SpeakerSegment = z.infer<typeof SpeakerSegmentSchema>;

export interface DiarizeOptions {
  readonly numSpeakersHint?: number;
  readonly signal?: AbortSignal;
}

export type DiarizeInput =
  | {
      readonly kind: 'audio';
      readonly data: Uint8Array;
      readonly mimeType: string;
    }
  | {
      readonly kind: 'transcript';
      readonly segments: readonly { readonly startMs: number; readonly endMs: number }[];
    };

export interface DiarizationProvider {
  readonly name: string;
  diarize(
    input: DiarizeInput,
    opts?: DiarizeOptions,
  ): AsyncIterable<SpeakerSegment>;
}

export class DiarizationError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;
  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'DiarizationError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}
