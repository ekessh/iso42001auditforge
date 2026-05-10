// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const ExtractEvidenceSchema = z
  .object({
    schemaId: z.enum(['ModelCard', 'Datasheet', 'FairnessReport', 'IncidentLog']),
    engagementId: z.string().min(1).optional(),
    imageBase64: z.string().min(1),
    imageMimeType: z.string().min(1),
    redactPii: z.boolean().default(true),
  })
  .strict();
export type ExtractEvidenceDto = z.infer<typeof ExtractEvidenceSchema>;

export class ExtractedFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() schemaId!: string;
  @ApiProperty() confidence!: number;
  @ApiProperty() modelName!: string;
  @ApiProperty({ required: false }) modelHash?: string;
  @ApiProperty() imageHash!: string;
  @ApiProperty() extractedAt!: string;
  @ApiProperty({ required: false }) engagementId?: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  value!: Record<string, unknown>;
}
