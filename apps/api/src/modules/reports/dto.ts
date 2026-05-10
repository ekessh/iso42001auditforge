// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const ReportKind = z.enum(['stage1', 'stage2', 'surveillance', 'recertification', 'special']);

export const CreateReportSchema = z.object({
  engagementId: z.string().uuid(),
  kind: ReportKind,
  title: z.string().min(1).max(400),
  bodyMarkdown: z.string().default(''),
});
export type CreateReportDto = z.infer<typeof CreateReportSchema>;

export const UpdateReportSchema = CreateReportSchema.partial().extend({
  bodyMarkdown: z.string().optional(),
});
export type UpdateReportDto = z.infer<typeof UpdateReportSchema>;

export const SignReportSchema = z.object({
  attestation: z.string().min(16),
  comment: z.string().max(2000).optional(),
});
export type SignReportDto = z.infer<typeof SignReportSchema>;

export class ReportDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty({ enum: ['stage1', 'stage2', 'surveillance', 'recertification', 'special'] }) kind!: string;
  @ApiProperty() title!: string;
  @ApiProperty() bodyMarkdown!: string;
  @ApiProperty({ enum: ['draft', 'in_review', 'reviewed', 'issued', 'archived'] }) status!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ required: false, format: 'date-time' }) issuedAt?: string;
  @ApiProperty({ required: false }) signedBy?: string;
  @ApiProperty({ required: false }) signatureRef?: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class ReportPageDto {
  @ApiProperty({ type: [ReportDto] }) items!: ReportDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true, required: false }) prevCursor?: string | null;
}
