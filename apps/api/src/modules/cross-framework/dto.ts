// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateCrossFrameworkSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCrossFrameworkDto = z.infer<typeof CreateCrossFrameworkSchema>;

export const UpdateCrossFrameworkSchema = CreateCrossFrameworkSchema.partial();
export type UpdateCrossFrameworkDto = z.infer<typeof UpdateCrossFrameworkSchema>;

export class CrossFrameworkDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CrossFrameworkPageDto {
  @ApiProperty({ type: [CrossFrameworkDto] }) items!: CrossFrameworkDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
