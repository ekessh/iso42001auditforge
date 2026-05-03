// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const EvidenceRefSchema = z.object({
  kind: z.enum(['evidence', 'probe', 'trace', 'interview', 'sample']),
  id: z.string().uuid(),
});
export type EvidenceRefDto = z.infer<typeof EvidenceRefSchema>;

export const CreateWorkingPaperSchema = z.object({
  engagementId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  title: z.string().min(1).max(400),
  controlRef: z.string().min(1).max(64),
  bodyMarkdown: z.string().default(''),
  evidenceRefs: z.array(EvidenceRefSchema).default([]),
});
export type CreateWorkingPaperDto = z.infer<typeof CreateWorkingPaperSchema>;

export const UpdateWorkingPaperSchema = CreateWorkingPaperSchema.partial();
export type UpdateWorkingPaperDto = z.infer<typeof UpdateWorkingPaperSchema>;

export class WorkingPaperDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty({ required: false }) templateId?: string;
  @ApiProperty() title!: string;
  @ApiProperty() controlRef!: string;
  @ApiProperty() bodyMarkdown!: string;
  @ApiProperty({ type: [Object] }) evidenceRefs!: EvidenceRefDto[];
  @ApiProperty({ enum: ['draft', 'in_review', 'final'] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class WorkingPaperPageDto {
  @ApiProperty({ type: [WorkingPaperDto] }) items!: WorkingPaperDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
