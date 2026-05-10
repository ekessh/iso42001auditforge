// SPDX-License-Identifier: BUSL-1.1
import type { ZodType } from 'zod';
import {
  type ExtractOptions,
  type ExtractionResult,
  type VlmExtractor,
} from '../types.js';
import { runSidecarExtraction, type SidecarVlmOptions } from './qwen.js';

export class DeepSeekOcrProvider implements VlmExtractor {
  public readonly name = 'deepseek-ocr';
  constructor(private readonly opts: SidecarVlmOptions) {}

  async extract<T>(
    image: Uint8Array,
    schema: ZodType<T>,
    opts: ExtractOptions,
  ): Promise<ExtractionResult<T>> {
    return runSidecarExtraction({
      providerName: this.name,
      endpoint: this.opts.endpoint,
      ...(this.opts.apiKey !== undefined ? { apiKey: this.opts.apiKey } : {}),
      ...(this.opts.fetchImpl !== undefined ? { fetchImpl: this.opts.fetchImpl } : {}),
      image,
      schema,
      opts,
    });
  }
}
