// SPDX-License-Identifier: BUSL-1.1
import type { Claim } from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore } from '../adapters/store.js';

export interface ContradictionDetectorDeps {
  store: AuditMemoryStore;
}

export interface ContradictionMatch {
  claim: Claim;
  via: 'subject_predicate_disagreement' | 'explicit_contradiction_edge';
}

export class ContradictionDetector {
  constructor(private readonly deps: ContradictionDetectorDeps) {}

  async detect(
    ctx: EngagementContext,
    candidate: { subject: string; predicate: string; object: string; id?: string },
  ): Promise<ContradictionMatch[]> {
    const claims = await this.deps.store.listClaims(ctx);
    const matches: ContradictionMatch[] = [];
    for (const c of claims) {
      if (c.validity !== 'active') continue;
      if (candidate.id && c.id === candidate.id) continue;
      if (
        c.subject === candidate.subject &&
        c.predicate === candidate.predicate &&
        c.object !== candidate.object
      ) {
        matches.push({ claim: c, via: 'subject_predicate_disagreement' });
      }
    }
    if (candidate.id) {
      const edges = await this.deps.store.listClaimRelations(ctx, {
        relation: 'contradicts',
      });
      for (const e of edges) {
        if (e.claimAId === candidate.id || e.claimBId === candidate.id) {
          const otherId = e.claimAId === candidate.id ? e.claimBId : e.claimAId;
          const other = claims.find((cc) => cc.id === otherId);
          if (other && other.validity === 'active') {
            const already = matches.some((m) => m.claim.id === other.id);
            if (!already) {
              matches.push({ claim: other, via: 'explicit_contradiction_edge' });
            }
          }
        }
      }
    }
    return matches;
  }
}
