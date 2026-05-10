// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateSurveillanceSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateSurveillanceDto = z.infer<typeof CreateSurveillanceSchema>;

export const UpdateSurveillanceSchema = CreateSurveillanceSchema.partial();
export type UpdateSurveillanceDto = z.infer<typeof UpdateSurveillanceSchema>;

export class SurveillanceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SurveillancePageDto {
  @ApiProperty({ type: [SurveillanceDto] }) items!: SurveillanceDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
