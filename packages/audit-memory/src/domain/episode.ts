// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';
import { UuidSchema, NonEmptyStringSchema, IsoDateSchema } from '@auditforge/shared';

export const EpisodeKindSchema = z.enum([
  'interview_turn',
  'auditee_answer',
  'evidence_upload',
  'system_event',
]);
export type EpisodeKind = z.infer<typeof EpisodeKindSchema>;

export const SpeakerRoleSchema = z.enum([
  'auditor',
  'auditee',
  'lead_auditor',
  'observer',
  'system',
]);
export type SpeakerRole = z.infer<typeof SpeakerRoleSchema>;

export const AttachmentSchema = z.object({
  id: UuidSchema,
  filename: NonEmptyStringSchema,
  mimeType: NonEmptyStringSchema,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  byteSize: z.number().int().nonnegative(),
  storageRef: NonEmptyStringSchema,
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const EpisodeSchema = z.object({
  id: UuidSchema,
  firmId: UuidSchema,
  engagementId: UuidSchema,
  kind: EpisodeKindSchema,
  sourceUtteranceId: UuidSchema.nullable(),
  speakerRole: SpeakerRoleSchema.nullable(),
  body: z.string().max(1_000_000),
  attachments: z.array(AttachmentSchema).default([]),
  parentEpisodeId: UuidSchema.nullable(),
  ingestionTime: IsoDateSchema,
  archivedAt: IsoDateSchema.nullable().optional(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const NewEpisodeSchema = EpisodeSchema.omit({
  id: true,
  ingestionTime: true,
  archivedAt: true,
}).extend({
  id: UuidSchema.optional(),
});
export type NewEpisode = z.infer<typeof NewEpisodeSchema>;
