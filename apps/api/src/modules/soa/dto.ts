// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateSoaSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateSoaDto = z.infer<typeof CreateSoaSchema>;

export const UpdateSoaSchema = CreateSoaSchema.partial();
export type UpdateSoaDto = z.infer<typeof UpdateSoaSchema>;

export class SoaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SoaPageDto {
  @ApiProperty({ type: [SoaDto] }) items!: SoaDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
