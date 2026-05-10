// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { apiFetch, type ApiFetchOptions } from './fetcher.js';

export const LiveParticipantSchema = z
  .object({
    auditorOrAuditeeId: z.string(),
    displayName: z.string(),
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
    speakerId: z.string().optional(),
  })
  .strict();
export type LiveParticipant = z.infer<typeof LiveParticipantSchema>;

export const LiveSessionSchema = z
  .object({
    id: z.string(),
    engagementId: z.string(),
    title: z.string(),
    status: z.string(),
    airGapMode: z.boolean(),
    transcriptionProviderName: z.string(),
    diarizationProviderName: z.string(),
    startedAt: z.string().optional(),
    endedAt: z.string().optional(),
  })
  .strict();
export type LiveSession = z.infer<typeof LiveSessionSchema>;

export const LiveTranscriptSegmentSchema = z
  .object({
    id: z.string(),
    startMs: z.number(),
    endMs: z.number(),
    text: z.string(),
    speakerId: z.string(),
    confidence: z.number(),
  })
  .strict();
export type LiveTranscriptSegment = z.infer<typeof LiveTranscriptSegmentSchema>;

export const LiveTranscriptSchema = z
  .object({
    sessionId: z.string(),
    segments: z.array(LiveTranscriptSegmentSchema),
  })
  .strict();
export type LiveTranscript = z.infer<typeof LiveTranscriptSchema>;

export const CoverageDeltaSchema = z
  .object({
    sessionId: z.string(),
    newlyEvidencedClauses: z.array(
      z.object({
        clauseId: z.string(),
        confidence: z.number(),
        segmentId: z.string(),
      }),
    ),
  })
  .strict();
export type CoverageDelta = z.infer<typeof CoverageDeltaSchema>;

export interface StartSessionBody {
  engagementId: string;
  title: string;
  participants: LiveParticipant[];
  airGapMode?: boolean;
  transcriptionProviderName?: string;
  diarizationProviderName?: string;
}

export function startSession(
  body: StartSessionBody,
  options: ApiFetchOptions<StartSessionBody> = {},
) {
  return apiFetch('/interviews', LiveSessionSchema, {
    ...options,
    method: 'POST',
    body,
  });
}

export function endSession(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/interviews/${id}/end`, LiveSessionSchema, {
    ...options,
    method: 'PATCH',
  });
}

export function getTranscript(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/interviews/${id}/transcript`, LiveTranscriptSchema, options);
}

export function getCoverageDelta(id: string, options: ApiFetchOptions = {}) {
  return apiFetch(`/interviews/${id}/coverage-delta`, CoverageDeltaSchema, options);
}
