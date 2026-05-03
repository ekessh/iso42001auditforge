// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const PresignUploadSchema = z.object({
  filename: z.string().min(1).max(400),
  mimeType: z.string().min(1).max(200),
  sizeBytes: z.number().int().positive().max(5 * 1024 * 1024 * 1024), // 5 GB
  engagementId: z.string().uuid().optional(),
});
export type PresignUploadDto = z.infer<typeof PresignUploadSchema>;

export const FinalizeUploadSchema = z.object({
  uploadId: z.string().uuid(),
  objectKey: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  engagementId: z.string().uuid().optional(),
});
export type FinalizeUploadDto = z.infer<typeof FinalizeUploadSchema>;

export class PresignedUploadResponseDto {
  @ApiProperty() uploadId!: string;
  @ApiProperty() bucket!: string;
  @ApiProperty() objectKey!: string;
  @ApiProperty() url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}

export class EvidenceDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() firmId!: string;
  @ApiProperty({ required: false }) engagementId?: string;
  @ApiProperty() filename!: string;
  @ApiProperty() mimeType!: string;
  @ApiProperty() sizeBytes!: number;
  @ApiProperty() sha256!: string;
  @ApiProperty() bucket!: string;
  @ApiProperty() objectKey!: string;
  @ApiProperty({ enum: ['uploaded', 'scanning', 'clean', 'infected', 'failed'] }) avStatus!: string;
  @ApiProperty({ enum: ['pending', 'running', 'done', 'skipped'] }) ocrStatus!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
}

export class EvidencePageDto {
  @ApiProperty({ type: [EvidenceDto] }) items!: EvidenceDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
  @ApiProperty({ nullable: true }) prevCursor!: string | null;
}

export class DownloadUrlDto {
  @ApiProperty() url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
