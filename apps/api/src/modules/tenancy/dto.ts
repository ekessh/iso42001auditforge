// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateTenancySchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateTenancyDto = z.infer<typeof CreateTenancySchema>;

export const UpdateTenancySchema = CreateTenancySchema.partial();
export type UpdateTenancyDto = z.infer<typeof UpdateTenancySchema>;

export class TenancyDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class TenancyPageDto {
  @ApiProperty({ type: [TenancyDto] }) items!: TenancyDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
