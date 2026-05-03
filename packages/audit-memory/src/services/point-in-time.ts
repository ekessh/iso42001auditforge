// SPDX-License-Identifier: BUSL-1.1
import type { Claim } from '../domain/claim.js';
import type { EngagementContext } from '../domain/tenant.js';
import type { AuditMemoryStore } from '../adapters/store.js';

export interface PointInTimeQueryDeps {
  store: AuditMemoryStore;
}

export interface PointInTimeOpts {
  includeAllStatuses?: boolean;
}

export class PointInTimeQuery {
  constructor(private readonly deps: PointInTimeQueryDeps) {}

  async asOf(
    ctx: EngagementContext,
    isoTimestamp: string,
    opts: PointInTimeOpts = {},
  ): Promise<Claim[]> {
    const ts = Date.parse(isoTimestamp);
    if (!Number.isFinite(ts)) {
      throw new Error(`invalid AS-OF timestamp: ${isoTimestamp}`);
    }
    const all = await this.deps.store.listClaims(ctx);
    const result: Claim[] = [];
    for (const claim of all) {
      const ingestion = Date.parse(claim.ingestionTime);
      if (ingestion > ts) continue;
      const start = Date.parse(claim.eventTimeStart);
      if (start > ts) continue;
      const history = await this.deps.store.listClaimTemporal(ctx, claim.id);
      let validityAtTs: Claim['validity'] = 'active';
      let endAtTs: string | null = null;
      const sortedHistory = [...history].sort(
        (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
      );
      for (const h of sortedHistory) {
        if (Date.parse(h.recordedAt) <= ts) {
          validityAtTs = h.validity;
          endAtTs = h.eventTimeEnd;
        } else {
          break;
        }
      }
      if (endAtTs && Date.parse(endAtTs) <= ts) {
        if (!opts.includeAllStatuses) continue;
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
