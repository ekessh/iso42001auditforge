// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const ExtractionSchemaIdSchema = z.enum([
  'ModelCard',
  'Datasheet',
  'FairnessReport',
  'IncidentLog',
]);
export type ExtractionSchemaId = z.infer<typeof ExtractionSchemaIdSchema>;

export const ExtractedFieldSchema = z
  .object({
    id: z.string(),
    schemaId: ExtractionSchemaIdSchema,
    confidence: z.number(),
    modelName: z.string(),
    modelHash: z.string().optional(),
    imageHash: z.string(),
    extractedAt: z.string(),
    engagementId: z.string().optional(),
    value: z.record(z.unknown()),
  })
  .strict();
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

export interface ExtractEvidenceBody {
  schemaId: ExtractionSchemaId;
  imageBase64: string;
  imageMimeType: string;
  engagementId?: string;
  redactPii?: boolean;
}

export function extractEvidence(
  body: ExtractEvidenceBody,
  options: ApiFetchOptions<ExtractEvidenceBody> = {},
) {
  return apiFetch('/evidence-extract', ExtractedFieldSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
