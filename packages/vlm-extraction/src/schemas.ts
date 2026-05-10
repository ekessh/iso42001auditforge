// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const ModelCardSchema = z
  .object({
    modelName: z.string().min(1),
    modelVersion: z.string().min(1),
    provider: z.string().optional(),
    intendedUse: z.string().optional(),
    trainingDataSummary: z.string().optional(),
    knownLimitations: z.array(z.string()).default([]),
    performanceMetrics: z
      .array(
        z.object({
          name: z.string().min(1),
          value: z.string().min(1),
          dataset: z.string().optional(),
        }),
      )
      .default([]),
    license: z.string().optional(),
    date: z.string().optional(),
  })
  .strict();
export type ModelCard = z.infer<typeof ModelCardSchema>;

export const DatasheetSchema = z
  .object({
    datasetName: z.string().min(1),
    datasetVersion: z.string().optional(),
    purpose: z.string().optional(),
    sourceComposition: z.string().optional(),
    annotationProcess: z.string().optional(),
    licensing: z.string().optional(),
    knownBiases: z.array(z.string()).default([]),
    sensitiveAttributesPresent: z.array(z.string()).default([]),
  })
  .strict();
export type Datasheet = z.infer<typeof DatasheetSchema>;

export const FairnessMetricSchema = z
  .object({
    metric: z.string().min(1),
    group: z.string().min(1),
    value: z.number(),
    threshold: z.number().optional(),
    pass: z.boolean().optional(),
  })
  .strict();

export const FairnessReportSchema = z
  .object({
    modelName: z.string().min(1),
    evaluatedAt: z.string().optional(),
    protectedAttributes: z.array(z.string()),
    metrics: z.array(FairnessMetricSchema),
    summary: z.string().optional(),
  })
  .strict();
export type FairnessReport = z.infer<typeof FairnessReportSchema>;

export const IncidentLogSchema = z
  .object({
    incidentId: z.string().min(1),
    detectedAt: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    summary: z.string().min(1),
    affectedSystems: z.array(z.string()).default([]),
    rootCause: z.string().optional(),
    correctiveAction: z.string().optional(),
    status: z.enum(['open', 'mitigated', 'closed']).default('open'),
  })
  .strict();
export type IncidentLog = z.infer<typeof IncidentLogSchema>;

export const BUNDLED_SCHEMAS = {
  ModelCard: ModelCardSchema,
  Datasheet: DatasheetSchema,
  FairnessReport: FairnessReportSchema,
  IncidentLog: IncidentLogSchema,
} as const;

export type BundledSchemaId = keyof typeof BUNDLED_SCHEMAS;
