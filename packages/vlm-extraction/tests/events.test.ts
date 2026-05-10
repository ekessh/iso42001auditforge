// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { buildExtractionEvent, imageSha256Hex } from '../src/events.js';
import type { ExtractionResult } from '../src/types.js';

describe('extraction events', () => {
  it('hashes image deterministically', () => {
    const a = imageSha256Hex(new Uint8Array([1, 2, 3]));
    const b = imageSha256Hex(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('builds an evidence.extracted event with summary', () => {
    const r: ExtractionResult<{ modelName: string; metrics: number[] }> = {
      value: { modelName: 'X', metrics: [1, 2, 3] },
      confidence: 0.9,
      sourceRegions: [],
      modelName: 'stub',
      modelHash: 'sha256:abc',
      extractedAt: '2026-05-10T00:00:00Z',
    };
    const evt = buildExtractionEvent('ModelCard', new Uint8Array([7]), r, 'eng-1');
    expect(evt.engagementId).toBe('eng-1');
    expect(evt.summary['modelName']).toBe('X');
    expect(evt.summary['metrics']).toBe('[3 items]');
    expect(evt.imageHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('truncates long string values in summary', () => {
    const long = 'x'.repeat(200);
    const r: ExtractionResult<{ s: string }> = {
      value: { s: long },
      confidence: 0.5,
      sourceRegions: [],
      modelName: 'm',
      extractedAt: '2026-05-10T00:00:00Z',
    };
    const evt = buildExtractionEvent('S', new Uint8Array([1]), r);
    expect((evt.summary['s'] as string).length).toBeLessThanOrEqual(80);
  });
});
