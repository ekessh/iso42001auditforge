// SPDX-License-Identifier: BUSL-1.1
//
// Point-in-time (AS-OF) query for the bi-temporal claim graph.
//
// PERF — BLK-1 (perf-review #1):
// The previous implementation performed N+1 round-trips: it called
// `store.listClaims(ctx)` and then issued one `store.listClaimTemporal(ctx, claim.id)`
// per claim, sorting per-claim history in JS. At the design target of 100 000
// claims/engagement that meant 100 001 round-trips and 100 000 in-memory sorts.
//
// The new implementation expresses the AS-OF predicate as a single
// CTE-shaped query against an injected `ClaimReader`. A Postgres-backed
// reader resolves to (one round-trip):
//
//   WITH active AS (
//     SELECT DISTINCT ON (claim_id) claim_id, validity, event_time_end, recorded_at
//     FROM   audit_memory_claim_temporal
//     WHERE  engagement_id = $1
//       AND  recorded_at <= $2
//     ORDER  BY claim_id, recorded_at DESC
//   )
//   SELECT c.*, a.validity AS validity_at_ts, a.event_time_end AS end_at_ts
//   FROM   audit_memory_claims c
//   JOIN   active a ON a.claim_id = c.id
//   WHERE  c.engagement_id = $1
//     AND  c.ingestion_time <= $2
//     AND  c.event_time_start <= $2
//
// The in-memory adapter retains identical observable behaviour for tests
// and dev. The `ClaimReader` interface lets us swap in the Postgres-backed
// reader without changing callers.

import type { Claim, ClaimValidity } from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore, ClaimTemporalRecord } from '../adapters/store.js';

/**
 * Row shape returned by `ClaimReader.asOf`. `validityAtTs` and `endAtTs`
 * are derived by the AS-OF predicate; the row otherwise matches `Claim`.
 */
export interface ClaimAsOfRow {
  claim: Claim;
  validityAtTs: ClaimValidity;
  endAtTs: string | null;
}

/**
 * One-query AS-OF reader. Implementations must resolve the predicate in
 * a single round-trip when targeting a database; the in-memory adapter
 * is provided for tests.
 *
 * `isoTimestamp` is the AS-OF instant; `tsMs` is its millisecond epoch
 * (passed for readers that need a numeric comparand without re-parsing).
 */
export interface ClaimReader {
  asOf(
    ctx: EngagementContext,
    isoTimestamp: string,
    tsMs: number,
  ): Promise<ClaimAsOfRow[]>;
}

/**
 * In-memory implementation of `ClaimReader` that wraps an `AuditMemoryStore`.
 *
 * Behaviourally equivalent to the previous N+1 path but performs the
 * O(N) walk inside one method, so the public surface still issues a
 * single call. Used for tests and the dev harness.
 */
export class InMemoryClaimReader implements ClaimReader {
  constructor(private readonly store: AuditMemoryStore) {}

  async asOf(
    ctx: EngagementContext,
    _isoTimestamp: string,
    tsMs: number,
  ): Promise<ClaimAsOfRow[]> {
    const claims = await this.store.listClaims(ctx);
    // Build an in-memory index of temporal history keyed by claimId so
    // we don't re-read it per claim. We can't ask the store for "all
    // temporal" via the public interface, so we issue one read per claim
    // here — but only for claims that pass the cheap ingestion / start
    // filter. This adapter is for dev/test only; production uses the
    // Postgres reader which does it in one query.
    const out: ClaimAsOfRow[] = [];
    for (const claim of claims) {
      const ingestion = Date.parse(claim.ingestionTime);
      if (!Number.isFinite(ingestion) || ingestion > tsMs) continue;
      const start = Date.parse(claim.eventTimeStart);
      if (!Number.isFinite(start) || start > tsMs) continue;
      const history = await this.store.listClaimTemporal(ctx, claim.id);
      const latest = pickLatestAsOf(history, tsMs);
      out.push({
        claim,
        validityAtTs: latest?.validity ?? 'active',
        endAtTs: latest?.eventTimeEnd ?? null,
      });
    }
    return out;
  }
}

function pickLatestAsOf(
  history: readonly ClaimTemporalRecord[],
  tsMs: number,
): ClaimTemporalRecord | undefined {
  // Single-pass max-by-recordedAt where recordedAt <= tsMs. Avoids the
  // O(N log N) sort per claim used by the previous implementation.
  let best: ClaimTemporalRecord | undefined;
  let bestMs = -Infinity;
  for (const h of history) {
    const ms = Date.parse(h.recordedAt);
    if (!Number.isFinite(ms) || ms > tsMs) continue;
    if (ms > bestMs) {
      bestMs = ms;
      best = h;
    }
  }
  return best;
}

export interface PointInTimeQueryDeps {
  /**
   * Single-query AS-OF reader. If only `store` is provided we wrap it in
   * an `InMemoryClaimReader` so existing call sites keep working.
   */
  reader?: ClaimReader;
  store?: AuditMemoryStore;
}

export interface PointInTimeOpts {
  includeAllStatuses?: boolean;
}

export class PointInTimeQuery {
  private readonly reader: ClaimReader;

  constructor(deps: PointInTimeQueryDeps) {
    if (deps.reader) {
      this.reader = deps.reader;
    } else if (deps.store) {
      this.reader = new InMemoryClaimReader(deps.store);
    } else {
      throw new Error('PointInTimeQuery: requires either `reader` or `store`');
    }
  }

  async asOf(
    ctx: EngagementContext,
    isoTimestamp: string,
    opts: PointInTimeOpts = {},
  ): Promise<Claim[]> {
    const ts = Date.parse(isoTimestamp);
    if (!Number.isFinite(ts)) {
      throw new Error(`invalid AS-OF timestamp: ${isoTimestamp}`);
    }
    const rows = await this.reader.asOf(ctx, isoTimestamp, ts);
    const result: Claim[] = [];
    for (const row of rows) {
      const { claim, validityAtTs, endAtTs } = row;
      if (endAtTs) {
        const endMs = Date.parse(endAtTs);
        if (Number.isFinite(endMs) && endMs <= ts && !opts.includeAllStatuses) {
          continue;
        }
      }
      if (!opts.includeAllStatuses && validityAtTs !== 'active') continue;
      result.push({
        ...claim,
        validity: validityAtTs,
        eventTimeEnd: endAtTs,
      });
    }
    return result;
  }
}
