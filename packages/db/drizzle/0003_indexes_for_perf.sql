-- SPDX-License-Identifier: BUSL-1.1
-- 0003_indexes_for_perf.sql
--
-- Composite indexes called out in docs/reviews/performance-review.md:
--   - Bi-temporal claim graph access patterns (engagement-scoped + time)
--   - Trigram fuzzy search on claim object_text
--   - Vector ANN on claim embeddings + clause catalogue (pgvector ivfflat)
--   - Workflow status indexes for findings + candidate_findings
--
-- All CREATE INDEX use IF NOT EXISTS so re-running the migration is safe.
-- ivfflat indexes are CONCURRENTLY-incompatible inside transactions, so they
-- are run outside the surrounding migration transaction by the migration
-- runner; we mark them with `-- @noTransaction` for drizzle-kit to detect.

-- ---------------------------------------------------------------------------
-- Episode ingestion lookup
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS episodes_engagement_ingestion_ix
    ON episodes (engagement_id, ingestion_time DESC);

-- ---------------------------------------------------------------------------
-- Bi-temporal claim windowing
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS claims_engagement_event_window_ix
    ON claims (engagement_id, event_time_start, event_time_end);

CREATE INDEX IF NOT EXISTS claims_engagement_record_window_ix
    ON claims (engagement_id, record_time_start, record_time_end);

-- ---------------------------------------------------------------------------
-- Subject-predicate graph traversal
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS claim_relations_subject_predicate_ix
    ON claim_relations (subject, predicate);

CREATE INDEX IF NOT EXISTS claim_relations_object_predicate_ix
    ON claim_relations (object, predicate);

-- ---------------------------------------------------------------------------
-- Trigram fuzzy search on claims.object_text
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS claims_object_text_trgm_ix
    ON claims USING gin (object_text gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Vector ANN on claims.embedding (ivfflat, cosine)
-- ---------------------------------------------------------------------------
-- ivfflat lists tuned to ~sqrt(N); we start at 100 (sufficient up to ~10k
-- vectors) and the perf review (INFO #3) flags HNSW as a follow-up.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'claims_embedding_ivfflat_ix' AND relkind = 'i'
    ) THEN
        EXECUTE 'CREATE INDEX claims_embedding_ivfflat_ix ON claims '
                'USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
    END IF;
EXCEPTION WHEN undefined_object THEN
    -- pgvector not available; index skipped.
    NULL;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE relname = 'clause_embeddings_ivfflat_ix' AND relkind = 'i'
    ) THEN
        EXECUTE 'CREATE INDEX clause_embeddings_ivfflat_ix ON clause_embeddings '
                'USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)';
    END IF;
EXCEPTION WHEN undefined_object THEN
    NULL;
END
$$;

-- ---------------------------------------------------------------------------
-- Findings + candidate_findings workflow lookups
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS candidate_findings_engagement_status_ix
    ON candidate_findings (engagement_id, status);

CREATE INDEX IF NOT EXISTS findings_engagement_raised_ix
    ON findings (engagement_id, raised_at DESC);

CREATE INDEX IF NOT EXISTS findings_engagement_state_ix
    ON findings (engagement_id, finding_state);

-- ---------------------------------------------------------------------------
-- Audit-ledger sequence per firm (chain replay)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS audit_ledger_events_firm_seq_ix
    ON audit_ledger_events (firm_id, sequence);

CREATE INDEX IF NOT EXISTS audit_ledger_events_engagement_seq_ix
    ON audit_ledger_events (engagement_id, sequence);

-- ---------------------------------------------------------------------------
-- Evidence lookup by engagement
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS evidence_objects_engagement_ix
    ON evidence_objects (engagement_id);

CREATE INDEX IF NOT EXISTS evidence_links_target_ix
    ON evidence_links (target_type, target_id);

-- ---------------------------------------------------------------------------
-- Surveillance time-series
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS surveillance_telemetry_engagement_observed_ix
    ON surveillance_telemetry (engagement_id, observed_at DESC);

-- ---------------------------------------------------------------------------
-- LLM invocations cost roll-up
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS llm_invocations_firm_created_ix
    ON llm_invocations (firm_id, created_at DESC);
