// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CandidateFindingTypeSchema = z.enum(['major', 'minor', 'ofi', 'observation']);
export type CandidateFindingType = z.infer<typeof CandidateFindingTypeSchema>;

export const CandidateFindingConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type CandidateFindingConfidence = z.infer<typeof CandidateFindingConfidenceSchema>;

export class ClauseChipDto {
  @ApiProperty() id!: string;
  @ApiProperty() label!: string;
}

export class CandidateFindingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['major', 'minor', 'ofi', 'observation'] }) type!: CandidateFindingType;
  @ApiProperty() typeLabel!: string;
  @ApiProperty() statement!: string;
  @ApiProperty({ type: [ClauseChipDto] }) clauses!: ClauseChipDto[];
  @ApiProperty({ enum: ['low', 'medium', 'high'] }) confidence!: CandidateFindingConfidence;
  @ApiProperty() source!: string;
  @ApiProperty({ type: [String] }) claimRefs!: string[];
  @ApiProperty() parked!: boolean;
}

export const PromoteCandidateFindingSchema = z.object({
  candidateFindingId: z.string(),
  severity: z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']),
  title: z.string().min(1).max(400),
  description: z.string().min(1).max(8000),
});
export type PromoteCandidateFindingDto = z.infer<typeof PromoteCandidateFindingSchema>;

export const DismissCandidateFindingSchema = z.object({
  rationale: z.string().min(1).max(4000),
});
export type DismissCandidateFindingDto = z.infer<typeof DismissCandidateFindingSchema>;

export class PromoteResultDto {
  @ApiProperty() findingId!: string;
}

export class DismissResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() status!: string;
}
