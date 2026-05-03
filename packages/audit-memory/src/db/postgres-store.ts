// SPDX-License-Identifier: BUSL-1.1
//
// Postgres-backed adapters for the audit-memory readers used by the
// performance-critical paths. We expose three thin classes:
//
//   - `PostgresClaimReader`         (BLK-1: bi-temporal AS-OF in one query)
//   - `PostgresSubjectPredicateReader`  (HI-08: index-backed contradiction lookup)
//   - `PostgresClaimRelationReader`     (BLK-5 helper: hoist-once relations fetch)
//
// They depend only on a minimal `SqlExecutor` interface (one parametrised
// query method) so they work with `postgres-js`, `pg`, drizzle, or any
// adapter that returns plain rows. The CTE shape used for the AS-OF
// query is the one called for in the perf-review remediation:
//
//   WITH active AS (
//     SELECT id FROM audit_memory_claims
//     WHERE engagement_id = $1
//       AND event_time_start <= $2
//       AND (event_time_end IS NULL OR event_time_end > $2)
//   )
//   SELECT * FROM audit_memory_claims c
//   JOIN active a ON a.id = c.id
//
// In practice we also need temporal-history join on `(claim_id, recorded_at)`
// to recover the validity at the AS-OF instant, so the production query
// wraps both predicates. Both forms are provided.

import type { Claim, ClaimValidity } from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type {
  ClaimAsOfRow,
  ClaimReader,
} from '../services/point-in-time.js';
import type { SubjectPredicateReader } from '../services/contradiction-detector.js';

/**
 * Minimal SQL surface. Implementations forward to the underlying driver
 * with parametrised placeholders ($1, $2, ...). Returning `unknown[]`
 * keeps us decoupled from any one driver's row shape.
 */
export interface SqlExecutor {
  query<TRow = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<TRow[]>;
}

interface ClaimRow {
  id: string;
  firm_id: string;
  engagement_id: string;
  schema_version_id: string;
  entity_type: string;
  subject: string;
  predicate: string;
  object: string;
  extracted_by_model: string;
  model_invocation_id: string;
  event_time_start: string | Date;
  event_time_end: string | Date | null;
  ingestion_time: string | Date;
  validity: ClaimValidity;
  embedding: number[] | string | null;
  evidence_episode_ids?: string[] | null;
}

interface ClaimAsOfRowDb extends ClaimRow {
  validity_at_ts: ClaimValidity;
  end_at_ts: string | Date | null;
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isoOrNull(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return iso(value);
}

function rowToClaim(row: ClaimRow): Claim {
  let embedding: number[] | null = null;
  if (Array.isArray(row.embedding)) {
    embedding = row.embedding;
  } else if (typeof row.embedding === 'string' && row.embedding.length > 0) {
    const trimmed = row.embedding.replace(/^\[|\]$/g, '');
    embedding = trimmed
      ? trimmed.split(',').map((n) => Number(n))
      : [];
  }
  return {
    id: row.id,
    firmId: row.firm_id,
    engagementId: row.engagement_id,
    schemaVersionId: row.schema_version_id,
    entityType: row.entity_type,
    subject: row.subject,
    predicate: row.predicate,
    object: row.object,
    evidenceEpisodeIds: row.evidence_episode_ids ?? [],
    extractedBy: {
      modelName: row.extracted_by_model,
      modelInvocationId: row.model_invocation_id,
    },
    eventTimeStart: iso(row.event_time_start),
    eventTimeEnd: isoOrNull(row.event_time_end),
    ingestionTime: iso(row.ingestion_time),
    validity: row.validity,
    embedding,
  };
}

/**
 * Bi-temporal AS-OF reader. One round-trip, index-backed.
 *
 * The query is the CTE form called out in the perf-review remediation:
 * the inner CTE applies the event-time predicate (using the
 * `audit_memory_claims_event_time_ix` composite index on
 * `(engagement_id, event_time_start, event_time_end)`); the outer join
 * recovers each claim's validity-at-ts via the most-recent temporal row
 * with `recorded_at <= $2`.
 */
export class PostgresClaimReader implements ClaimReader {
  constructor(private readonly sql: SqlExecutor) {}

  async asOf(
    ctx: EngagementContext,
    isoTimestamp: string,
    _tsMs: number,
  ): Promise<ClaimAsOfRow[]> {
    const sql = `
WITH active AS (
  SELECT id
  FROM   audit_memory_claims
  WHERE  engagement_id = $1
    AND  ingestion_time <= $2
    AND  event_time_start <= $2
    AND  (event_time_end IS NULL OR event_time_end > $2)
),
latest_temporal AS (
  SELECT DISTINCT ON (claim_id)
         claim_id,
         validity,
         event_time_end,
         recorded_at
  FROM   audit_memory_claim_temporal
  WHERE  engagement_id = $1
    AND  recorded_at <= $2
  ORDER  BY claim_id, recorded_at DESC
)
SELECT c.id,
       c.firm_id,
       c.engagement_id,
       c.schema_version_id,
       c.entity_type,
       c.subject,
       c.predicate,
       c.object,
       c.extracted_by_model,
       c.model_invocation_id,
       c.event_time_start,
       c.event_time_end,
       c.ingestion_time,
       c.validity,
       c.embedding,
       COALESCE(t.validity, c.validity)            AS validity_at_ts,
       COALESCE(t.event_time_end, c.event_time_end) AS end_at_ts
FROM   audit_memory_claims c
JOIN   active a            ON a.id = c.id
LEFT JOIN latest_temporal t ON t.claim_id = c.id
WHERE  c.engagement_id = $1
`;
    const rows = await this.sql.query<ClaimAsOfRowDb>(sql, [
      ctx.engagementId,
      isoTimestamp,
    ]);
    return rows.map((r) => ({
      claim: rowToClaim(r),
      validityAtTs: r.validity_at_ts,
      endAtTs: isoOrNull(r.end_at_ts),
    }));
  }
}

/**
 * Subject/predicate index-backed reader. Uses
 * `audit_memory_claims_subj_pred_ix(engagement_id, subject, predicate)`.
 */
export class PostgresSubjectPredicateReader implements SubjectPredicateReader {
  constructor(private readonly sql: SqlExecutor) {}

  async findBySubjectPredicate(
    ctx: EngagementContext,
    subject: string,
    predicate: string,
    excludeClaimId?: string,
  ): Promise<Claim[]> {
    const sql = `
SELECT id, firm_id, engagement_id, schema_version_id, entity_type, subject,
       predicate, object, extracted_by_model, model_invocation_id,
       event_time_start, event_time_end, ingestion_time, validity, embedding
FROM   audit_memory_claims
WHERE  engagement_id = $1
  AND  subject = $2
  AND  predicate = $3
  AND  validity = 'active'
  AND  ($4::uuid IS NULL OR id <> $4)
`;
    const rows = await this.sql.query<ClaimRow>(sql, [
      ctx.engagementId,
      subject,
      predicate,
      excludeClaimId ?? null,
    ]);
    return rows.map(rowToClaim);
  }

  async getClaimsByIds(
    ctx: EngagementContext,
    ids: readonly string[],
  ): Promise<Claim[]> {
    if (ids.length === 0) return [];
    const sql = `
SELECT id, firm_id, engagement_id, schema_version_id, entity_type, subject,
       predicate, object, extracted_by_model, model_invocation_id,
       event_time_start, event_time_end, ingestion_time, validity, embedding
FROM   audit_memory_claims
WHERE  engagement_id = $1
  AND  id = ANY($2::uuid[])
`;
    const rows = await this.sql.query<ClaimRow>(sql, [
      ctx.engagementId,
      [...ids],
    ]);
    return rows.map(rowToClaim);
  }
}
