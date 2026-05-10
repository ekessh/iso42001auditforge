-- SPDX-License-Identifier: BUSL-1.1
-- 0006_search_hnsw_and_catalogue_embeddings.sql
--
-- Adds the search-engine substrate:
--   1. catalogue_embeddings table — single home for ISO 42001 / Annex A /
--      EU AI Act / NIST AI RMF / OWASP LLM Top 10 / MITRE ATLAS / AVID /
--      MIT AI Risk / cross-framework-mapping vectors. Replaces the narrower
--      clause_embeddings table for cross-framework retrieval (clause table
--      stays for back-compat).
--   2. Embedding columns on candidate_findings, working_papers,
--      wp_observations, episodes — every artifact the conversational engine
--      and search controller need to surface to auditors. claims already has
--      vector(1536) from 0002.
--   3. HNSW indexes on every embedding column. HNSW out-performs ivfflat at
--      our scale (~10k–100k vectors per engagement) and supports concurrent
--      writes without a rebuild step. The 0003 ivfflat indexes are left in
--      place; the planner picks whichever fits the query.
--
-- Idempotent: every CREATE uses IF NOT EXISTS or DO-block guard.

BEGIN;

-- =========================================================================
-- 1. Ensure pgvector is loaded (no-op if 0000 already ran)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =========================================================================
-- 2. catalogue_embeddings — cross-framework retrieval store
-- =========================================================================
-- Vector dimension is 1536 to match clause_embeddings/claims so the same
-- Ollama nomic-embed-text + zero-padding adapter feeds every column. Smaller
-- providers (384-dim sentence-transformers) zero-pad through the storage
-- adapter rather than forcing a schema flag day.

CREATE TABLE IF NOT EXISTS catalogue_embeddings (
    id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
    framework   text        NOT NULL,
    node_id     text        NOT NULL,
    embedding   vector(1536),
    metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT  catalogue_embeddings_framework_node_uq UNIQUE (framework, node_id)
);

-- Service role manages the catalogue (firm-agnostic); read-role queries it
-- through joins on framework/node_id. No firm_id, so no RLS attached.
GRANT SELECT ON catalogue_embeddings TO app_request_role;
GRANT INSERT, UPDATE ON catalogue_embeddings TO app_service_role;

-- =========================================================================
-- 3. Embedding columns on per-engagement artefacts
-- =========================================================================

ALTER TABLE candidate_findings    ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE working_papers        ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE wp_observations       ADD COLUMN IF NOT EXISTS embedding vector(1536);
ALTER TABLE episodes              ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- =========================================================================
-- 4. HNSW indexes on every embedding column
-- =========================================================================
-- m=16, ef_construction=64 is the pgvector default sweet spot for cosine
-- similarity at our cardinality. Tunable per-engagement at the client via
-- `SET LOCAL hnsw.ef_search = <n>` if recall needs tightening.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'claims_embedding_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX claims_embedding_hnsw_ix ON claims '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'clause_embeddings_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX clause_embeddings_hnsw_ix ON clause_embeddings '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'catalogue_embeddings_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX catalogue_embeddings_hnsw_ix ON catalogue_embeddings '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'candidate_findings_embedding_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX candidate_findings_embedding_hnsw_ix ON candidate_findings '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'working_papers_embedding_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX working_papers_embedding_hnsw_ix ON working_papers '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'wp_observations_embedding_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX wp_observations_embedding_hnsw_ix ON wp_observations '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'episodes_embedding_hnsw_ix' AND relkind = 'i') THEN
        EXECUTE 'CREATE INDEX episodes_embedding_hnsw_ix ON episodes '
                'USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)';
    END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

COMMIT;
