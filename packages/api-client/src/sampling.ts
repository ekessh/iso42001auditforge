// SPDX-License-Identifier: BUSL-1.1

import { z } from 'zod';

import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const SamplingMethodSchema = z.enum([
  'random',
  'systematic',
  'stratified',
  'risk_based',
  'judgmental',
  'mus',
]);
export type SamplingMethod = z.infer<typeof SamplingMethodSchema>;

export const PopulationUnitSchema = z.object({
  id: z.string(),
  stratum: z.string().optional(),
  riskScore: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type PopulationUnit = z.infer<typeof PopulationUnitSchema>;

export const PopulationSchema = z.object({
  populationId: z.string(),
  category: z.enum(['use_cases', 'models', 'agents', 'datasets', 'incidents', 'transactions']),
  description: z.string(),
  units: z.array(PopulationUnitSchema),
});
export type Population = z.infer<typeof PopulationSchema>;

export const DrawnUnitSchema = z.object({
  unitId: z.string(),
  planId: z.string(),
  selectionIndex: z.number(),
  weight: z.number(),
  stratum: z.string().optional(),
  rationale: z.string().optional(),
});
export type DrawnUnit = z.infer<typeof DrawnUnitSchema>;

export const DrawSampleResultSchema = z.object({
  planId: z.string(),
  method: z.string(),
  seed: z.string(),
  populationSize: z.number(),
  sampleSize: z.number(),
  units: z.array(DrawnUnitSchema),
});
export type DrawSampleResult = z.infer<typeof DrawSampleResultSchema>;

export interface DrawSampleBody {
  planId: string;
  method: SamplingMethod;
  seed: string;
  size: number;
  confidence?: number;
  population: Population;
  values?: Record<string, number>;
}

export function drawSample(
  body: DrawSampleBody,
  options: ApiFetchOptions<DrawSampleBody> = {},
) {
  return apiFetch('/samples/draw', DrawSampleResultSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export interface OverrideSampleBody {
  planId: string;
  removedUnitId: string;
  addedUnitId: string;
  rationale: string;
  population: Population;
  currentUnits: {
    unitId: string;
    planId: string;
    selectionIndex: number;
    weight: number;
    stratum?: string;
  }[];
}

export const OverrideSampleResultSchema = z.object({
  planId: z.string(),
  units: z.array(DrawnUnitSchema),
});

export function overrideSample(
  body: OverrideSampleBody,
  options: ApiFetchOptions<OverrideSampleBody> = {},
) {
  return apiFetch('/samples/override', OverrideSampleResultSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export const SizeCalculatorResultSchema = z.object({
  formula: z.string(),
  size: z.number(),
});
export type SizeCalculatorResult = z.infer<typeof SizeCalculatorResultSchema>;

export type SizeCalculatorBody =
  | {
      formula: 'attribute';
      N: number;
      confidence: number;
      tolerableDeviationRate: number;
      expectedDeviationRate: number;
    }
  | {
      formula: 'variable';
      N: number;
      confidence: number;
      populationStdDev: number;
      tolerableMisstatement: number;
      expectedMisstatement: number;
    }
  | {
      formula: 'mus';
      populationValue: number;
      materiality: number;
      expectedMisstatement: number;
      confidence: number;
    };

export function calculateSize(
  body: SizeCalculatorBody,
  options: ApiFetchOptions<SizeCalculatorBody> = {},
) {
  return apiFetch('/samples/calculate-size', SizeCalculatorResultSchema, {
    ...options,
    method: 'POST',
    body,
  });
}
