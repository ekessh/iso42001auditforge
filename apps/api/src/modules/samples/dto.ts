// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateSamplesSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateSamplesDto = z.infer<typeof CreateSamplesSchema>;

export const UpdateSamplesSchema = CreateSamplesSchema.partial();
export type UpdateSamplesDto = z.infer<typeof UpdateSamplesSchema>;

export class SamplesDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SamplesPageDto {
  @ApiProperty({ type: [SamplesDto] }) items!: SamplesDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}

const SamplingMethodApiSchema = z.enum([
  'random',
  'systematic',
  'stratified',
  'risk_based',
  'judgmental',
  'mus',
]);

export const PopulationUnitSchema = z.object({
  id: z.string().min(1),
  stratum: z.string().min(1).optional(),
  riskScore: z.number().min(0).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const DrawSampleSchema = z.object({
  planId: z.string().uuid(),
  method: SamplingMethodApiSchema,
  seed: z.string().min(1).max(256),
  size: z.number().int().min(0).max(100000),
  confidence: z.number().min(0).max(1).default(0.95),
  population: z.object({
    populationId: z.string().uuid(),
    category: z.enum(['use_cases', 'models', 'agents', 'datasets', 'incidents', 'transactions']),
    description: z.string().min(1),
    units: z.array(PopulationUnitSchema).min(1),
  }),
  /** Optional unit-id â†’ numeric value map for MUS. */
  values: z.record(z.string().min(1), z.number().nonnegative()).optional(),
});
export type DrawSampleDto = z.infer<typeof DrawSampleSchema>;

export class DrawnSampleUnitDto {
  @ApiProperty() unitId!: string;
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() selectionIndex!: number;
  @ApiProperty() weight!: number;
  @ApiProperty({ required: false }) stratum?: string;
  @ApiProperty({ required: false }) rationale?: string;
}

export class DrawSampleResultDto {
  @ApiProperty({ format: 'uuid' }) planId!: string;
  @ApiProperty() method!: string;
  @ApiProperty() seed!: string;
  @ApiProperty() populationSize!: number;
  @ApiProperty() sampleSize!: number;
  @ApiProperty({ type: [DrawnSampleUnitDto] }) units!: DrawnSampleUnitDto[];
}

export const OverrideSampleSchema = z.object({
  planId: z.string().uuid(),
  removedUnitId: z.string().min(1),
  addedUnitId: z.string().min(1),
  rationale: z.string().min(8).max(2000),
  population: z.object({
    populationId: z.string().uuid(),
    category: z.enum(['use_cases', 'models', 'agents', 'datasets', 'incidents', 'transactions']),
    description: z.string().min(1),
    units: z.array(PopulationUnitSchema).min(1),
  }),
  currentUnits: z.array(
    z.object({
      unitId: z.string().min(1),
      planId: z.string().uuid(),
      selectionIndex: z.number().int().nonnegative(),
      weight: z.number().nonnegative().default(1),
      stratum: z.string().min(1).optional(),
    }),
  ),
});
export type OverrideSampleDto = z.infer<typeof OverrideSampleSchema>;

export const SizeCalculatorSchema = z.discriminatedUnion('formula', [
  z.object({
    formula: z.literal('attribute'),
    N: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    tolerableDeviationRate: z.number().min(0).max(1),
    expectedDeviationRate: z.number().min(0).max(1),
  }),
  z.object({
    formula: z.literal('variable'),
    N: z.number().int().nonnegative(),
    confidence: z.number().min(0).max(1),
    populationStdDev: z.number().positive(),
    tolerableMisstatement: z.number().positive(),
    expectedMisstatement: z.number().nonnegative(),
  }),
  z.object({
    formula: z.literal('mus'),
    populationValue: z.number().positive(),
    materiality: z.number().positive(),
    expectedMisstatement: z.number().nonnegative(),
    confidence: z.number().min(0).max(1),
  }),
]);
export type SizeCalculatorDto = z.infer<typeof SizeCalculatorSchema>;

export class SizeCalculatorResultDto {
  @ApiProperty() size!: number;
  @ApiProperty() formula!: string;
}
