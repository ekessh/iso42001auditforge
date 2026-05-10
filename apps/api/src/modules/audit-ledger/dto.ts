// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const LedgerQuerySchema = z.object({
  type: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  fromSeq: z.coerce.number().int().nonnegative().optional(),
  toSeq: z.coerce.number().int().nonnegative().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type LedgerQueryDto = z.infer<typeof LedgerQuerySchema>;

export class LedgerEventDto {
  @ApiProperty() id!: string;
  @ApiProperty() sequence!: number;
  @ApiProperty() firmId!: string;
  @ApiProperty({ required: false }) engagementId?: string;
  @ApiProperty() actorId!: string;
  @ApiProperty({ required: false }) actorRole?: string;
  @ApiProperty() type!: string;
  @ApiProperty() entity!: string;
  @ApiProperty() entityId!: string;
  @ApiProperty({ type: Object }) payload!: Record<string, unknown>;
  @ApiProperty() prevHash!: string;
  @ApiProperty() hash!: string;
  @ApiProperty({ format: 'date-time' }) emittedAt!: string;
}

export class LedgerPageDto {
  @ApiProperty({ type: [LedgerEventDto] }) items!: LedgerEventDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}

export class ChainVerificationDto {
  @ApiProperty() ok!: boolean;
  @ApiProperty({ required: false }) head?: string;
  @ApiProperty() verifiedAt!: string;
}
