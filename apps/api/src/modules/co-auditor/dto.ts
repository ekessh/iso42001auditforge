// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateCoAuditorSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateCoAuditorDto = z.infer<typeof CreateCoAuditorSchema>;

export const UpdateCoAuditorSchema = CreateCoAuditorSchema.partial();
export type UpdateCoAuditorDto = z.infer<typeof UpdateCoAuditorSchema>;

export class CoAuditorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class CoAuditorPageDto {
  @ApiProperty({ type: [CoAuditorDto] }) items!: CoAuditorDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
