// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateAiSystemsSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateAiSystemsDto = z.infer<typeof CreateAiSystemsSchema>;

export const UpdateAiSystemsSchema = CreateAiSystemsSchema.partial();
export type UpdateAiSystemsDto = z.infer<typeof UpdateAiSystemsSchema>;

export class AiSystemsDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AiSystemsPageDto {
  @ApiProperty({ type: [AiSystemsDto] }) items!: AiSystemsDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
