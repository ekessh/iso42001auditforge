// SPDX-License-Identifier: BUSL-1.1
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, firmIdColumn, idColumn, updatedAt } from './_shared.js';

export const liveInterviewStatusEnum = pgEnum('live_interview_status', [
  'scheduled',
  'in_progress',
  'ended',
  'archived',
]);

export const interviewSessions = pgTable(
  'interview_sessions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id').notNull(),
    title: text('title').notNull(),
    status: liveInterviewStatusEnum('status').notNull().default('scheduled'),
    airGapMode: boolean('air_gap_mode').notNull().default(true),
    transcriptionProviderName: text('transcription_provider_name')
      .notNull()
      .default('stub'),
    diarizationProviderName: text('diarization_provider_name')
      .notNull()
      .default('stub'),
    participants: jsonb('participants').notNull().default([]),
    speakerMap: jsonb('speaker_map').notNull().default({}),
    consent: jsonb('consent'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    ixFirm: index('interview_sessions_firm_ix').on(t.firmId),
    ixEng: index('interview_sessions_engagement_ix').on(t.firmId, t.engagementId),
  }),
);

export const interviewTranscripts = pgTable(
  'interview_transcripts',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => interviewSessions.id, { onDelete: 'cascade' }),
    segmentId: text('segment_id').notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text('text').notNull(),
    speakerId: text('speaker_id').notNull(),
    confidence: doublePrecision('confidence').notNull(),
    words: jsonb('words').notNull().default([]),
    attachedClauses: jsonb('attached_clauses').notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => ({
    ixSession: index('interview_transcripts_session_ix').on(t.sessionId, t.startMs),
    ixFirm: index('interview_transcripts_firm_ix').on(t.firmId),
    uqSegment: unique('interview_transcripts_segment_uq').on(t.sessionId, t.segmentId),
  }),
);

export const evidenceExtractions = pgTable(
  'evidence_extractions',
  {
    id: idColumn(),
    firmId: firmIdColumn(),
    engagementId: uuid('engagement_id'),
    schemaId: text('schema_id').notNull(),
    modelName: text('model_name').notNull(),
    modelHash: text('model_hash'),
    imageHash: text('image_hash').notNull(),
    imageBucket: text('image_bucket'),
    imageObjectKey: text('image_object_key'),
    imageMimeType: text('image_mime_type'),
    confidence: doublePrecision('confidence').notNull(),
    extractedValue: jsonb('extracted_value').notNull(),
    sourceRegions: jsonb('source_regions').notNull().default([]),
    redacted: boolean('redacted').notNull().default(true),
    extractedAt: timestamp('extracted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
  },
  (t) => ({
    ixFirm: index('evidence_extractions_firm_ix').on(t.firmId),
    ixEng: index('evidence_extractions_engagement_ix').on(t.firmId, t.engagementId),
    ixSchema: index('evidence_extractions_schema_ix').on(t.schemaId),
  }),
);
