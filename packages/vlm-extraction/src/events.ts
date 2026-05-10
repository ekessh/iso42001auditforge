// SPDX-License-Identifier: BUSL-1.1
import { createHash } from 'node:crypto';
import type { ExtractionResult } from './types.js';

export interface ExtractionLedgerEvent {
  readonly name: 'evidence.extracted';
  readonly engagementId?: string;
  readonly schemaId: string;
  readonly modelName: string;
  readonly modelHash?: string;
  readonly imageHash: string;
  readonly summary: Record<string, unknown>;
  readonly confidence: number;
  readonly at: string;
}

export interface ExtractionEventEmitter {
  publish(event: ExtractionLedgerEvent): Promise<void>;
}

export function imageSha256Hex(image: Uint8Array): string {
  return createHash('sha256').update(image).digest('hex');
}

export function buildExtractionEvent(
  schemaId: string,
  image: Uint8Array,
  result: ExtractionResult<unknown>,
  engagementId?: string,
): ExtractionLedgerEvent {
  const summary: Record<string, unknown> = {};
  if (result.value && typeof result.value === 'object') {
    for (const [k, v] of Object.entries(result.value as Record<string, unknown>)) {
      if (typeof v === 'string') {
        summary[k] = v.length > 80 ? `${v.slice(0, 77)}...` : v;
      } else if (typeof v === 'number' || typeof v === 'boolean') {
        summary[k] = v;
      } else if (Array.isArray(v)) {
        summary[k] = `[${v.length} items]`;
      }
    }
  }
  return {
    name: 'evidence.extracted',
    ...(engagementId !== undefined ? { engagementId } : {}),
    schemaId,
    modelName: result.modelName,
    ...(result.modelHash !== undefined ? { modelHash: result.modelHash } : {}),
    imageHash: imageSha256Hex(image),
    summary,
    confidence: result.confidence,
    at: result.extractedAt,
  };
}
