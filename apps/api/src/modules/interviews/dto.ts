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
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
