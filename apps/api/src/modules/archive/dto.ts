// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateArchiveSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateArchiveDto = z.infer<typeof CreateArchiveSchema>;

export const UpdateArchiveSchema = CreateArchiveSchema.partial();
export type UpdateArchiveDto = z.infer<typeof UpdateArchiveSchema>;

export class ArchiveDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class ArchivePageDto {
  @ApiProperty({ type: [ArchiveDto] }) items!: ArchiveDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
