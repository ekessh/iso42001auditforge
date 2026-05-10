// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateRisksSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateRisksDto = z.infer<typeof CreateRisksSchema>;

export const UpdateRisksSchema = CreateRisksSchema.partial();
export type UpdateRisksDto = z.infer<typeof UpdateRisksSchema>;

export class RisksDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class RisksPageDto {
  @ApiProperty({ type: [RisksDto] }) items!: RisksDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
