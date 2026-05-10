// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateInterviewsSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateInterviewsDto = z.infer<typeof CreateInterviewsSchema>;

export const UpdateInterviewsSchema = CreateInterviewsSchema.partial();
export type UpdateInterviewsDto = z.infer<typeof UpdateInterviewsSchema>;

export class InterviewsDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class InterviewsPageDto {
  @ApiProperty({ type: [InterviewsDto] }) items!: InterviewsDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}

const RoleSchema = z.enum([
  'top_management',
  'ai_system_owner',
  'data_scientist',
  'risk_officer',
  'it_operations',
  'auditee_lead',
  'external_stakeholder',
]);

export const ComposeInterviewPlanSchema = z.object({
  engagementId: z.string().uuid(),
  roles: z.array(RoleSchema).min(1),
  clauses: z.array(z.string().min(1)).default([]),
  durationMinutes: z.number().int().min(1).max(600),
  mode: z.enum(['audit', 'readiness', 'both']).default('audit'),
  clauseFocus: z.record(z.string().min(1), z.number().min(0).max(10)).default({}),
});
export type ComposeInterviewPlanDto = z.infer<typeof ComposeInterviewPlanSchema>;

export class InterviewLibraryEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() role!: string;
  @ApiProperty({ type: [String] }) clauseRefs!: string[];
  @ApiProperty({ type: [String] }) applicableModes!: string[];
  @ApiProperty({ type: [String] }) aiSystemClasses!: string[];
  @ApiProperty() question!: string;
  @ApiProperty({ type: [String] }) followUps!: string[];
  @ApiProperty({ type: [String] }) evidenceToSeek!: string[];
  @ApiProperty({ type: [String] }) commonPitfalls!: string[];
  @ApiProperty() timeBoxMinutes!: number;
  @ApiProperty() weight!: number;
}

export class InterviewLibraryListDto {
  @ApiProperty({ type: [InterviewLibraryEntryDto] }) items!: InterviewLibraryEntryDto[];
}

export class InterviewPlanItemDto {
  @ApiProperty({ type: InterviewLibraryEntryDto }) entry!: InterviewLibraryEntryDto;
  @ApiProperty() score!: number;
}

export class InterviewPlanDto {
  @ApiProperty({ format: 'uuid' }) engagementId!: string;
  @ApiProperty() totalDurationMinutes!: number;
  @ApiProperty({ type: [InterviewPlanItemDto] }) items!: InterviewPlanItemDto[];
  @ApiProperty({ type: Object }) coverage!: Record<string, number>;
}
