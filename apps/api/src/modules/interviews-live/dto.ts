// SPDX-License-Identifier: BUSL-1.1
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export const StartInterviewSchema = z
  .object({
    engagementId: z.string().min(1),
    title: z.string().min(1),
    participants: z
      .array(
        z.object({
          auditorOrAuditeeId: z.string().min(1),
          displayName: z.string().min(1),
          role: z.enum([
            'lead_auditor',
            'associate_auditor',
            'auditee_lead',
            'top_management',
            'ai_system_owner',
            'data_scientist',
            'risk_officer',
            'it_operations',
            'external_stakeholder',
          ]),
          speakerId: z.string().min(1).optional(),
        }),
      )
      .min(1),
    airGapMode: z.boolean().default(true),
    transcriptionProviderName: z.string().min(1).default('stub'),
    diarizationProviderName: z.string().min(1).default('stub'),
  })
  .strict();
export type StartInterviewDto = z.infer<typeof StartInterviewSchema>;

export class InterviewSessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() title!: string;
  @ApiProperty() status!: string;
  @ApiProperty() airGapMode!: boolean;
  @ApiProperty() transcriptionProviderName!: string;
  @ApiProperty() diarizationProviderName!: string;
  @ApiProperty({ required: false }) startedAt?: string;
  @ApiProperty({ required: false }) endedAt?: string;
}

export class InterviewTranscriptSegmentDto {
  @ApiProperty() id!: string;
  @ApiProperty() startMs!: number;
  @ApiProperty() endMs!: number;
  @ApiProperty() text!: string;
  @ApiProperty() speakerId!: string;
  @ApiProperty() confidence!: number;
}

export class InterviewTranscriptDto {
  @ApiProperty() sessionId!: string;
  @ApiProperty({ type: [InterviewTranscriptSegmentDto] })
  segments!: InterviewTranscriptSegmentDto[];
}

export class CoverageDeltaItemDto {
  @ApiProperty() clauseId!: string;
  @ApiProperty() confidence!: number;
  @ApiProperty() segmentId!: string;
}

export class CoverageDeltaDto {
  @ApiProperty() sessionId!: string;
  @ApiProperty({ type: [CoverageDeltaItemDto] })
  newlyEvidencedClauses!: CoverageDeltaItemDto[];
}
