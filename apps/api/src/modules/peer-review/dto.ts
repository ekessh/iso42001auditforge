// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const CreatePeerReviewSchema = z.object({
  name: z.string().min(1).max(200),
  metadata: z.record(z.unknown()).optional(),
});
export type CreatePeerReviewDto = z.infer<typeof CreatePeerReviewSchema>;

export const UpdatePeerReviewSchema = CreatePeerReviewSchema.partial();
export type UpdatePeerReviewDto = z.infer<typeof UpdatePeerReviewSchema>;

export class PeerReviewDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false, type: Object }) metadata?: Record<string, unknown>;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PeerReviewPageDto {
  @ApiProperty({ type: [PeerReviewDto] }) items!: PeerReviewDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}
