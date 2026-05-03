-- SPDX-License-Identifier: BUSL-1.1
-- 0000_extensions.sql
-- Mirrors infra/postgres-init/01-extensions.sql so that environments which
-- skip the postgres-init shell (Testcontainers, hand-rolled CI databases,
-- accreditation read replicas) still have the same surface available.
-- Idempotent: every statement uses IF NOT EXISTS.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
