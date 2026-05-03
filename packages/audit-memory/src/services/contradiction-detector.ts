// SPDX-License-Identifier: BUSL-1.1
//
// PERF — HI-08 (perf-review High #5):
// Previously this loaded *all* engagement claims via `store.listClaims(ctx)`
// then linear-scanned for subject/predicate matches — O(N) per call where
// N is the engagement claim count. The schema already has the index
// `audit_memory_claims_subj_pred_ix(engagement_id, subject, predicate)`
// but the index was never used because the path never reached SQL.
//
// We now query through an injected `SubjectPredicateReader`. A
// Postgres-backed adapter resolves to:
//
//   SELECT * FROM audit_memory_claims
//   WHERE engagement_id = $1
//     AND subject = $2
//     AND predicate = $3
//     AND validity = 'active'
//     AND ($4::uuid IS NULL OR id <> $4)
//
// — one round-trip, index-backed. The in-memory adapter retains identical
// observable behaviour for tests.

import type { Claim } from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore } from '../adapters/store.js';

export interface SubjectPredicateReader {
  /**
   * Return active claims in `(engagement, subject, predicate)` matching the
   * tuple, optionally excluding `excludeClaimId`. Implementations must use
   * a covering index — full-table scans are not acceptable.
   */
  findBySubjectPredicate(
    ctx: EngagementContext,
    subject: string,
    predicate: string,
    excludeClaimId?: string,
  ): Promise<Claim[]>;

  /**
   * Hydrate claims for the given ids, scoped to the engagement. Used to
   * resolve the "other" endpoint of explicit `contradicts` edges.
   */
  getClaimsByIds(ctx: EngagementContext, ids: readonly string[]): Promise<Claim[]>;
}

/**
 * In-memory reader. Walks `listClaims` once but exposes the same surface
 * as a Postgres-backed reader so tests don't need a live database.
 */
export class InMemorySubjectPredicateReader implements SubjectPredicateReader {
  constructor(private readonly store: AuditMemoryStore) {}

  async findBySubjectPredicate(
    ctx: EngagementContext,
    subject: string,
    predicate: string,
    excludeClaimId?: string,
  ): Promise<Claim[]> {
    const all = await this.store.listClaims(ctx);
    const out: Claim[] = [];
    for (const c of all) {
      if (c.validity !== 'active') continue;
      if (c.subject !== subject || c.predicate !== predicate) continue;
      if (excludeClaimId !== undefined && c.id === excludeClaimId) continue;
      out.push(c);
    }
    return out;
  }

  async getClaimsByIds(
    ctx: EngagementContext,
    ids: readonly string[],
  ): Promise<Claim[]> {
    if (ids.length === 0) return [];
    const set = new Set(ids);
    const all = await this.store.listClaims(ctx);
    return all.filter((c) => set.has(c.id));
  }
}

export interface ContradictionDetectorDeps {
  /** Index-backed reader. If omitted we fall back to in-memory via `store`. */
  reader?: SubjectPredicateReader;
  store: AuditMemoryStore;
}

export interface ContradictionMatch {
  claim: Claim;
  via: 'subject_predicate_disagreement' | 'explicit_contradiction_edge';
}

export class ContradictionDetector {
  private readonly reader: SubjectPredicateReader;

  constructor(private readonly deps: ContradictionDetectorDeps) {
    this.reader = deps.reader ?? new InMemorySubjectPredicateReader(deps.store);
  }

  async detect(
    ctx: EngagementContext,
    candidate: { subject: string; predicate: string; object: string; id?: string },
  ): Promise<ContradictionMatch[]> {
    // Index-backed lookup of (subject, predicate) candidates rather than
    // a full engagement scan.
    const peers = await this.reader.findBySubjectPredicate(
      ctx,
      candidate.subject,
      candidate.predicate,
      candidate.id,
    );
    const matches: ContradictionMatch[] = [];
    for (const c of peers) {
      if (c.object !== candidate.object) {
        matches.push({ claim: c, via: 'subject_predicate_disagreement' });
      }
    }
    if (candidate.id) {
      const edges = await this.deps.store.listClaimRelations(ctx, {
        relation: 'contradicts',
      });
      const otherIds: string[] = [];
      for (const e of edges) {
        if (e.claimAId === candidate.id) otherIds.push(e.claimBId);
        else if (e.claimBId === candidate.id) otherIds.push(e.claimAId);
      }
      if (otherIds.length > 0) {
        const others = await this.reader.getClaimsByIds(ctx, otherIds);
        const seen = new Set(matches.map((m) => m.claim.id));
        for (const other of others) {
          if (other.validity !== 'active') continue;
          if (seen.has(other.id)) continue;
          seen.add(other.id);
          matches.push({ claim: other, via: 'explicit_contradiction_edge' });
        }
      }
    }
    return matches;
  }
}
