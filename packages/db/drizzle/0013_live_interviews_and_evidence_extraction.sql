-- SPDX-License-Identifier: BUSL-1.1
-- 0013_live_interviews_and_evidence_extraction.sql
--
-- Phase 7.6 tables:
--   * interview_sessions       — live interview session lifecycle + consent state
--   * interview_transcripts    — labeled transcript segments per session
--   * evidence_extractions     — VLM extraction results (model card, datasheet, etc.)
--
-- All tables enforce per-firm RLS using the existing `app.current_firm`
-- session GUC, matching the pattern in 0002_rls_business_tables.sql.

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'live_interview_status') THEN
    CREATE TYPE live_interview_status AS ENUM (
      'scheduled',
      'in_progress',
      'ended',
      'archived'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS interview_sessions (
    id                          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id                     uuid NOT NULL,
    engagement_id               uuid NOT NULL,
    title                       text NOT NULL,
    status                      live_interview_status NOT NULL DEFAULT 'scheduled',
    air_gap_mode                boolean NOT NULL DEFAULT true,
    transcription_provider_name text NOT NULL DEFAULT 'stub',
    diarization_provider_name   text NOT NULL DEFAULT 'stub',
    participants                jsonb NOT NULL DEFAULT '[]'::jsonb,
    speaker_map                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    consent                     jsonb,
    started_at                  timestamptz,
    ended_at                    timestamptz,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interview_sessions_firm_idx
    ON interview_sessions(firm_id);
CREATE INDEX IF NOT EXISTS interview_sessions_engagement_idx
    ON interview_sessions(firm_id, engagement_id);

ALTER TABLE interview_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'interview_sessions'
       AND policyname = 'firm_isolation'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY firm_isolation ON interview_sessions
        USING (firm_id = current_setting('app.current_firm', true)::uuid)
        WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
    $POL$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS interview_transcripts (
    id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id             uuid NOT NULL,
    session_id          uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
    segment_id          text NOT NULL,
    start_ms            integer NOT NULL,
    end_ms              integer NOT NULL,
    text                text NOT NULL,
    speaker_id          text NOT NULL,
    confidence          double precision NOT NULL,
    words               jsonb NOT NULL DEFAULT '[]'::jsonb,
    attached_clauses    jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, segment_id)
);

CREATE INDEX IF NOT EXISTS interview_transcripts_session_idx
    ON interview_transcripts(session_id, start_ms);
CREATE INDEX IF NOT EXISTS interview_transcripts_firm_idx
    ON interview_transcripts(firm_id);

ALTER TABLE interview_transcripts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'interview_transcripts'
       AND policyname = 'firm_isolation'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY firm_isolation ON interview_transcripts
        USING (firm_id = current_setting('app.current_firm', true)::uuid)
        WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
    $POL$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS evidence_extractions (
    id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id         uuid NOT NULL,
    engagement_id   uuid,
    schema_id       text NOT NULL,
    model_name      text NOT NULL,
    model_hash      text,
    image_hash      text NOT NULL,
    image_bucket    text,
    image_object_key text,
    image_mime_type text,
    confidence      double precision NOT NULL,
    extracted_value jsonb NOT NULL,
    source_regions  jsonb NOT NULL DEFAULT '[]'::jsonb,
    redacted        boolean NOT NULL DEFAULT true,
    extracted_at    timestamptz NOT NULL DEFAULT now(),
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS evidence_extractions_firm_idx
    ON evidence_extractions(firm_id);
CREATE INDEX IF NOT EXISTS evidence_extractions_engagement_idx
    ON evidence_extractions(firm_id, engagement_id);
CREATE INDEX IF NOT EXISTS evidence_extractions_schema_idx
    ON evidence_extractions(schema_id);

ALTER TABLE evidence_extractions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'evidence_extractions'
       AND policyname = 'firm_isolation'
  ) THEN
    EXECUTE $POL$
      CREATE POLICY firm_isolation ON evidence_extractions
        USING (firm_id = current_setting('app.current_firm', true)::uuid)
        WITH CHECK (firm_id = current_setting('app.current_firm', true)::uuid);
    $POL$;
  END IF;
END $$;

COMMIT;
