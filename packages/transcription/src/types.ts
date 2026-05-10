// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const TranscriptWordSchema = z
  .object({
    text: z.string().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
  })
  .strict();
export type TranscriptWord = z.infer<typeof TranscriptWordSchema>;

export const TranscriptSegmentSchema = z
  .object({
    id: z.string().min(1),
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative(),
    text: z.string(),
    words: z.array(TranscriptWordSchema),
    confidence: z.number().min(0).max(1),
    language: z.string().optional(),
    isFinal: z.boolean().default(true),
  })
  .strict();
export type TranscriptSegment = z.infer<typeof TranscriptSegmentSchema>;

export interface TranscribeOptions {
  readonly language?: string;
  readonly streaming?: boolean;
  readonly modelHint?: string;
  readonly signal?: AbortSignal;
}

export type AudioSource =
  | { readonly kind: 'buffer'; readonly data: Uint8Array; readonly mimeType: string }
  | {
      readonly kind: 'stream';
      readonly chunks: AsyncIterable<Uint8Array>;
      readonly mimeType: string;
    };

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(
    audio: AudioSource,
    opts?: TranscribeOptions,
  ): AsyncIterable<TranscriptSegment>;
}

export class TranscriptionError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;
  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'TranscriptionError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}
