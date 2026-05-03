// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const EngagementStage = z.enum(['stage1', 'stage2', 'surveillance', 'recertification', 'special']);
export const EngagementStatus = z.enum(['planned', 'in_progress', 'reporting', 'reviewed', 'issued', 'archived', 'cancelled']);

export const CreateEngagementSchema = z.object({
  clientId: z.string().uuid(),
  stage: EngagementStage,
  scopeStatement: z.string().min(1).max(4000),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  leadAuditorId: z.string().uuid(),
  teamMemberIds: z.array(z.string().uuid()).default([]),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateEngagementDto = z.infer<typeof CreateEngagementSchema>;

export const UpdateEngagementSchema = CreateEngagementSchema.partial();
export type UpdateEngagementDto = z.infer<typeof UpdateEngagementSchema>;

export const TransitionEngagementSchema = z.object({
  to: EngagementStatus,
  reason: z.string().min(1).max(2000).optional(),
});
export type TransitionEngagementDto = z.infer<typeof TransitionEngagementSchema>;

export class EngagementDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() clientId!: string;
  @ApiProperty({ enum: ['stage1', 'stage2', 'surveillance', 'recertification', 'special'] }) stage!: string;
  @ApiProperty({ enum: ['planned', 'in_progress', 'reporting', 'reviewed', 'issued', 'archived', 'cancelled'] }) status!: string;
  @ApiProperty() scopeStatement!: string;
  @ApiProperty({ format: 'date' }) startsOn!: string;
  @ApiProperty({ format: 'date' }) endsOn!: string;
  @ApiProperty() leadAuditorId!: string;
  @ApiProperty({ type: [String] }) teamMemberIds!: string[];
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
}

export class EngagementPageDto {
  @ApiProperty({ type: [EngagementDto] }) items!: EngagementDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
