// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ModelCardSchema } from '../src/schemas.js';
import { StubVlmProvider } from '../src/providers/stub.js';
import { VlmExtractionError } from '../src/types.js';

const fakeImage = new Uint8Array([1, 2, 3]);

describe('StubVlmProvider', () => {
  it('returns a schema-shaped value', async () => {
    const p = new StubVlmProvider();
    const r = await p.extract(fakeImage, ModelCardSchema, { schemaId: 'ModelCard' });
    expect(r.value.modelName).toBe('StubModel');
    expect(ModelCardSchema.safeParse(r.value).success).toBe(true);
  });

  it('rejects empty image', async () => {
    const p = new StubVlmProvider();
    await expect(
      p.extract(new Uint8Array(), ModelCardSchema, { schemaId: 'ModelCard' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('rejects unknown schema id', async () => {
    const p = new StubVlmProvider();
    await expect(
      p.extract(fakeImage, z.object({}).passthrough(), { schemaId: 'NotAThing' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('rejects malformed fixture', async () => {
    const p = new StubVlmProvider({
      fixtures: { ModelCard: { modelName: 1 } },
    });
    await expect(
      p.extract(fakeImage, ModelCardSchema, { schemaId: 'ModelCard' }),
    ).rejects.toBeInstanceOf(VlmExtractionError);
  });

  it('redacts PII from string fields by default', async () => {
    const p = new StubVlmProvider({
      fixtures: {
        ModelCard: {
          modelName: 'M',
          modelVersion: '1',
          intendedUse: 'contact alice@example.com or 555-12-3456',
          knownLimitations: [],
          performanceMetrics: [],
        },
      },
    });
    const r = await p.extract(fakeImage, ModelCardSchema, { schemaId: 'ModelCard' });
    expect(r.value.intendedUse).not.toContain('alice@example.com');
    expect(r.value.intendedUse).toContain('[REDACTED_EMAIL]');
  });

  it('skips redaction when redactPii=false', async () => {
    const p = new StubVlmProvider({
      fixtures: {
        ModelCard: {
          modelName: 'M',
          modelVersion: '1',
          intendedUse: 'a@b.com',
          knownLimitations: [],
          performanceMetrics: [],
        },
      },
    });
    const r = await p.extract(fakeImage, ModelCardSchema, {
      schemaId: 'ModelCard',
      redactPii: false,
    });
    expect(r.value.intendedUse).toBe('a@b.com');
  });
});
