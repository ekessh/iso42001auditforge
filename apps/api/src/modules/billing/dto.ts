// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateBillingSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateBillingDto = z.infer<typeof CreateBillingSchema>;

export const UpdateBillingSchema = CreateBillingSchema.partial();
export type UpdateBillingDto = z.infer<typeof UpdateBillingSchema>;

export class BillingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class BillingPageDto {
  @ApiProperty({ type: [BillingDto] }) items!: BillingDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
