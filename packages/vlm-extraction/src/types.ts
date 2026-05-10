// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import type { ZodType } from 'zod';

export const SourceRegionSchema = z
  .object({
    page: z.number().int().nonnegative().optional(),
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
    label: z.string().optional(),
  })
  .strict();
export type SourceRegion = z.infer<typeof SourceRegionSchema>;

export interface ExtractionResult<T> {
  readonly value: T;
  readonly confidence: number;
  readonly sourceRegions: readonly SourceRegion[];
  readonly modelName: string;
  readonly modelHash?: string;
  readonly extractedAt: string;
}

export interface ExtractOptions {
  readonly schemaId: string;
  readonly engagementId?: string;
  readonly signal?: AbortSignal;
  readonly redactPii?: boolean;
}

export interface VlmExtractor {
  readonly name: string;
  extract<T>(
    image: Uint8Array,
    schema: ZodType<T>,
    opts: ExtractOptions,
  ): Promise<ExtractionResult<T>>;
}

export class VlmExtractionError extends Error {
  public readonly code: string;
  public override readonly cause?: unknown;
  constructor(message: string, code: string, cause?: unknown) {
    super(message);
    this.name = 'VlmExtractionError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}
