// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const InterviewStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'ended',
  'archived',
]);
export type InterviewStatus = z.infer<typeof InterviewStatusSchema>;

export const ParticipantRoleSchema = z.enum([
  'lead_auditor',
  'associate_auditor',
  'auditee_lead',
  'top_management',
  'ai_system_owner',
  'data_scientist',
  'risk_officer',
  'it_operations',
  'external_stakeholder',
]);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

export const ParticipantSchema = z
  .object({
    auditorOrAuditeeId: z.string().min(1),
    displayName: z.string().min(1),
    role: ParticipantRoleSchema,
    speakerId: z.string().min(1).optional(),
  })
  .strict();
export type Participant = z.infer<typeof ParticipantSchema>;

export const ConsentRecordSchema = z
  .object({
    engagementId: z.string().min(1),
    grantedBy: z.string().min(1),
    grantedAt: z.string().min(1),
    revokedAt: z.string().min(1).optional(),
    method: z.enum(['written', 'electronic', 'recorded']),
    notes: z.string().optional(),
  })
  .strict();
export type ConsentRecord = z.infer<typeof ConsentRecordSchema>;

export const InterviewSessionSchema = z
  .object({
    id: z.string().min(1),
    firmId: z.string().min(1),
    engagementId: z.string().min(1),
    title: z.string().min(1),
    status: InterviewStatusSchema,
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
    participants: z.array(ParticipantSchema),
    speakerMap: z.record(z.string(), z.string()),
    consent: ConsentRecordSchema.optional(),
    airGapMode: z.boolean(),
    transcriptionProviderName: z.string(),
    diarizationProviderName: z.string(),
  })
  .strict();
export type InterviewSession = z.infer<typeof InterviewSessionSchema>;

export interface CandidateAttachment {
  readonly clauseId: string;
  readonly confidence: number;
  readonly source: 'attribution-engine';
  readonly transcriptSegmentId: string;
}

export interface ComposerSegmentResult {
  readonly segmentId: string;
  readonly attached: readonly CandidateAttachment[];
  readonly unattributed: boolean;
  readonly contradiction: boolean;
}

export class LiveInterviewError extends Error {
  public readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'LiveInterviewError';
    this.code = code;
  }
}
