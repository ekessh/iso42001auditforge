// SPDX-License-Identifier: BUSL-1.1
import type { ZodType } from 'zod';
import { redactPiiDeep } from '../redaction.js';
import {
  VlmExtractionError,
  type ExtractOptions,
  type ExtractionResult,
  type VlmExtractor,
} from '../types.js';
import { BUNDLED_SCHEMAS, type BundledSchemaId } from '../schemas.js';

const STUB_BY_SCHEMA: Record<BundledSchemaId, unknown> = {
  ModelCard: {
    modelName: 'StubModel',
    modelVersion: '0.1.0',
    provider: 'AuditForge',
    intendedUse: 'Test fixture for VLM extraction',
    trainingDataSummary: 'Synthetic data for tests only',
    knownLimitations: ['Stub: not for production'],
    performanceMetrics: [{ name: 'accuracy', value: '0.99', dataset: 'synthetic' }],
    license: 'BUSL-1.1',
  },
  Datasheet: {
    datasetName: 'StubDataset',
    datasetVersion: '2026.01',
    purpose: 'Stub fixture',
    sourceComposition: 'Synthetic',
    annotationProcess: 'N/A',
    licensing: 'CC0',
    knownBiases: [],
    sensitiveAttributesPresent: [],
  },
  FairnessReport: {
    modelName: 'StubModel',
    protectedAttributes: ['gender', 'race'],
    metrics: [{ metric: 'demographic_parity', group: 'all', value: 0.01 }],
    summary: 'Stub fairness report',
  },
  IncidentLog: {
    incidentId: 'INC-STUB-1',
    detectedAt: '2026-01-01T00:00:00Z',
    severity: 'low',
    summary: 'Stub incident for tests',
    affectedSystems: [],
    status: 'closed',
  },
};

export interface StubVlmProviderOptions {
  readonly fixtures?: Partial<Record<string, unknown>>;
  readonly clock?: () => string;
}

export class StubVlmProvider implements VlmExtractor {
  public readonly name = 'stub-vlm';

  constructor(private readonly opts: StubVlmProviderOptions = {}) {}

  async extract<T>(
    image: Uint8Array,
    schema: ZodType<T>,
    opts: ExtractOptions,
  ): Promise<ExtractionResult<T>> {
    if (image.byteLength === 0) {
      throw new VlmExtractionError('image buffer is empty', 'EMPTY_IMAGE');
    }
    const fixture =
      this.opts.fixtures?.[opts.schemaId] ??
      STUB_BY_SCHEMA[opts.schemaId as BundledSchemaId];
    if (fixture === undefined) {
      throw new VlmExtractionError(`no stub fixture for schema "${opts.schemaId}"`, 'NO_FIXTURE');
    }
    const candidate = opts.redactPii ?? true ? redactPiiDeep(fixture) : fixture;
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      throw new VlmExtractionError('stub fixture failed schema', 'SCHEMA');
    }
    return {
      value: parsed.data,
      confidence: 0.92,
      sourceRegions: [{ x: 0, y: 0, width: 1, height: 1, label: 'stub' }],
      modelName: this.name,
      modelHash: 'sha256:stub',
      extractedAt: (this.opts.clock ?? (() => new Date().toISOString()))(),
    };
  }
}

export function bundledSchemaFor(id: string): ZodType<unknown> | null {
  return (BUNDLED_SCHEMAS as Record<string, ZodType<unknown>>)[id] ?? null;
}
