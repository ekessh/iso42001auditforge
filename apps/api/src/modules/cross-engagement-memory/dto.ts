// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const PatternKindSchema = z.enum([
  'clause_evidence_failure_rate',
  'probe_failure_rate',
]);
export type PatternKindDto = z.infer<typeof PatternKindSchema>;

export const PatternQuerySchema = z
  .object({
    kind: PatternKindSchema.optional(),
    scope: z.string().max(2000).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();
export type PatternQueryDto = z.infer<typeof PatternQuerySchema>;

export class PatternDto {
  @ApiProperty() id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty({ enum: ['clause_evidence_failure_rate', 'probe_failure_rate'] })
  patternKind!: PatternKindDto;
  @ApiProperty({ type: 'object', additionalProperties: true })
  dimensions!: Record<string, string | number | boolean>;
  @ApiProperty() sampleSize!: number;
  @ApiProperty() observation!: string;
  @ApiProperty() confidence!: number;
  @ApiProperty() lastUpdated!: string;
}

export class PatternPageDto {
  @ApiProperty({ type: [PatternDto] }) items!: PatternDto[];
}

export const AggregateRequestSchema = z
  .object({
    engagementId: z.string().min(1),
    scopeDimensions: z.record(z.string()).default({}),
    clauseObservations: z.array(
      z.object({
        clauseId: z.string().min(1),
        status: z.enum(['evidenced', 'partial', 'contradicted', 'untouched', 'na']),
      }),
    ),
    probeOutcomes: z.array(
      z.object({
        probeId: z.string().min(1),
        passed: z.boolean(),
      }),
    ),
  })
  .strict();
export type AggregateRequestDto = z.infer<typeof AggregateRequestSchema>;

export class AggregateResultDto {
  @ApiProperty() patternsTouched!: number;
  @ApiProperty() patternsSkipped!: number;
  @ApiProperty({ type: [String] }) skippedReasons!: string[];
}
