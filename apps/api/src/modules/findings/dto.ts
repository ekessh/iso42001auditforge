// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const FindingSeverity = z.enum(['major_nc', 'minor_nc', 'ofi', 'conformity']);
export const FindingStatus = z.enum(['open', 'capa_pending', 'capa_in_progress', 'closed', 'verified']);

export const CreateFindingSchema = z.object({
  engagementId: z.string().uuid(),
  controlRef: z.string().min(1).max(64),
  severity: FindingSeverity,
  title: z.string().min(1).max(400),
  description: z.string().min(1).max(8000),
  evidence: z.array(z.string().uuid()).default([]),
  workingPaperId: z.string().uuid().optional(),
});
export type CreateFindingDto = z.infer<typeof CreateFindingSchema>;

export const UpdateFindingSchema = CreateFindingSchema.partial();
export type UpdateFindingDto = z.infer<typeof UpdateFindingSchema>;

export class FindingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() controlRef!: string;
  @ApiProperty({ enum: ['major_nc', 'minor_nc', 'ofi', 'conformity'] }) severity!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) evidence!: string[];
  @ApiProperty({ enum: ['open', 'capa_pending', 'capa_in_progress', 'closed', 'verified'] }) status!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class FindingPageDto {
  @ApiProperty({ type: [FindingDto] }) items!: FindingDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
