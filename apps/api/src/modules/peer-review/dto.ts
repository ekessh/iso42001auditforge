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

export const CommentScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('finding'), findingId: z.string().uuid() }),
  z.object({ kind: z.literal('clause'), clauseRef: z.string().min(1) }),
  z.object({ kind: z.literal('global') }),
]);

export const AddCommentSchema = z.object({
  parentId: z.string().uuid().nullable().default(null),
  scope: CommentScopeSchema,
  body: z.string().min(1).max(8000),
  flag: z.enum(['standard', 'security', 'data-protection']).default('standard'),
});
export type AddCommentDto = z.infer<typeof AddCommentSchema>;

export const ResolveCommentSchema = z.object({
  resolutionNote: z.string().max(8000).default(''),
});
export type ResolveCommentDto = z.infer<typeof ResolveCommentSchema>;

export class PeerReviewCommentDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) packageId!: string;
  @ApiProperty({ nullable: true, format: 'uuid' }) parentId!: string | null;
  @ApiProperty({ format: 'uuid' }) authorId!: string;
  @ApiProperty({ type: Object }) scope!: Record<string, unknown>;
  @ApiProperty() body!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time', required: false }) resolvedAt?: string;
  @ApiProperty({ required: false, format: 'uuid' }) resolvedBy?: string;
  @ApiProperty({ required: false }) resolutionNote?: string;
  @ApiProperty({ enum: ['standard', 'security', 'data-protection'] }) flag!:
    | 'standard'
    | 'security'
    | 'data-protection';
}

export class PeerReviewCommentListDto {
  @ApiProperty({ type: [PeerReviewCommentDto] }) items!: PeerReviewCommentDto[];
}
