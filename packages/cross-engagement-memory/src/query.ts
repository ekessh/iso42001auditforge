// SPDX-License-Identifier: BUSL-1.1
/**
 * Read-only query API. Wraps a `PatternRepository` and exposes the
 * domain-typed surface used by the API and the MCP tools.
 */

import type {
  CrossEngagementPattern,
  PatternQuery,
  PatternRepository,
} from './domain.js';
import { PatternQuerySchema } from './domain.js';

export class CrossEngagementMemoryQuery {
  private readonly repo: PatternRepository;

  constructor(repo: PatternRepository) {
    this.repo = repo;
  }

  async query(input: PatternQuery): Promise<readonly CrossEngagementPattern[]> {
    const q = PatternQuerySchema.parse(input);
    return this.repo.query(q);
  }

  async exportFirm(firmId: string): Promise<readonly CrossEngagementPattern[]> {
    if (!firmId) throw new Error('firmId required');
    return this.repo.exportFirm(firmId);
  }
}

export class InMemoryPatternRepository implements PatternRepository {
  private readonly rows = new Map<string, CrossEngagementPattern>();

  async upsert(p: CrossEngagementPattern): Promise<void> {
    this.rows.set(p.id, p);
  }

  async query(q: PatternQuery): Promise<readonly CrossEngagementPattern[]> {
    const out: CrossEngagementPattern[] = [];
    for (const r of this.rows.values()) {
      if (r.firmId !== q.firmId) continue;
      if (q.patternKind && r.patternKind !== q.patternKind) continue;
      if (q.scope && !matchesScope(r.dimensions, q.scope)) continue;
      out.push(r);
    }
    out.sort((a, b) => (a.lastUpdated < b.lastUpdated ? 1 : a.lastUpdated > b.lastUpdated ? -1 : 0));
    const limit = q.limit ?? 50;
    return out.slice(0, limit);
  }

  async exportFirm(firmId: string): Promise<readonly CrossEngagementPattern[]> {
    const out: CrossEngagementPattern[] = [];
    for (const r of this.rows.values()) {
      if (r.firmId === firmId) out.push(r);
    }
    return out;
  }

  size(): number {
    return this.rows.size;
  }
}

function matchesScope(
  dimensions: Record<string, unknown>,
  scope: Record<string, string>,
): boolean {
  for (const [k, v] of Object.entries(scope)) {
    if (dimensions[k] !== v) return false;
  }
  return true;
}
