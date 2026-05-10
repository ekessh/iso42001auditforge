// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreateAuditPlansSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateAuditPlansDto = z.infer<typeof CreateAuditPlansSchema>;

export const UpdateAuditPlansSchema = CreateAuditPlansSchema.partial();
export type UpdateAuditPlansDto = z.infer<typeof UpdateAuditPlansSchema>;

export class AuditPlansDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class AuditPlansPageDto {
  @ApiProperty({ type: [AuditPlansDto] }) items!: AuditPlansDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
