// SPDX-License-Identifier: BUSL-1.1
//
// BLK-1 perf-regression test for `PointInTimeQuery`.
//
// Functional gate: when wired through a `ClaimReader` (e.g. the
// Postgres-backed reader), the AS-OF query must issue exactly one
// reader call per `asOf()` invocation regardless of claim count.
// Performance is documented but not gated on CI hardware.

import { describe, expect, it } from 'vitest';
import type { Claim } from '../src/domain/claim.js';
import type { EngagementContext } from '../src/domain/tenant.js';
import {
  PointInTimeQuery,
  type ClaimAsOfRow,
  type ClaimReader,
} from '../src/services/point-in-time.js';

const FIRM = '11111111-1111-1111-1111-111111111111';
const ENG = '22222222-2222-2222-2222-222222222222';

function buildClaim(id: string, overrides: Partial<Claim> = {}): Claim {
  return {
    id,
    firmId: FIRM,
    engagementId: ENG,
    schemaVersionId: '33333333-3333-3333-3333-333333333333',
    entityType: 'AISystem',
    subject: 'AISystem:default',
    predicate: 'covers',
    object: 'Clause:6.1.2',
    evidenceEpisodeIds: [],
    extractedBy: { modelName: 'mock', modelInvocationId: '44444444-4444-4444-4444-444444444444' },
    eventTimeStart: '2030-01-01T00:00:00.000Z',
    eventTimeEnd: null,
    ingestionTime: '2030-01-01T00:00:00.000Z',
    validity: 'active',
    embedding: null,
    ...overrides,
  };
}

class CountingReader implements ClaimReader {
  public calls = 0;
  constructor(private readonly rows: ClaimAsOfRow[]) {}
  async asOf(
    _ctx: EngagementContext,
    _iso: string,
    _tsMs: number,
  ): Promise<ClaimAsOfRow[]> {
    this.calls += 1;
    return this.rows;
  }
}

describe('PointInTimeQuery (perf — BLK-1)', () => {
  it('issues exactly one reader call regardless of claim count', async () => {
    const N = 10_000;
    const rows: ClaimAsOfRow[] = [];
    for (let i = 0; i < N; i++) {
      rows.push({
        claim: buildClaim(`claim-${i.toString().padStart(8, '0')}`),
        validityAtTs: 'active',
        endAtTs: null,
      });
    }
    const reader = new CountingReader(rows);
    const q = new PointInTimeQuery({ reader });
    const result = await q.asOf(
      { firmId: FIRM, engagementId: ENG },
      '2030-06-01T00:00:00.000Z',
    );
    expect(reader.calls).toBe(1);
    expect(result.length).toBe(N);
  });

  it('processes 100k AS-OF rows in under the documented SLO target', async () => {
    // Documents the 100k-claim AS-OF target. We don't gate CI on wall time
    // because hardware varies, but we assert correctness and log the timing.
    const N = 100_000;
    const rows: ClaimAsOfRow[] = [];
    for (let i = 0; i < N; i++) {
      const validity =
        i % 5 === 0 ? 'invalidated' : ('active' as const);
      rows.push({
        claim: buildClaim(`c-${i}`),
        validityAtTs: validity,
        endAtTs: validity === 'invalidated' ? '2030-04-01T00:00:00.000Z' : null,
      });
    }
    const reader = new CountingReader(rows);
    const q = new PointInTimeQuery({ reader });
    const start = process.hrtime.bigint();
    const result = await q.asOf(
      { firmId: FIRM, engagementId: ENG },
      '2030-06-01T00:00:00.000Z',
    );
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    // Functional gate: only active rows survive, invalidated are dropped.
    expect(result.length).toBe(N - Math.floor(N / 5));
    // Documented SLO target — informational only.
    // eslint-disable-next-line no-console
    console.log(`[BLK-1 SLO] 100k AS-OF rows processed in ${elapsedMs.toFixed(1)}ms`);
    expect(reader.calls).toBe(1);
  });

  it('honours includeAllStatuses to surface invalidated claims', async () => {
    const reader = new CountingReader([
      {
        claim: buildClaim('c-1'),
        validityAtTs: 'invalidated',
        endAtTs: '2030-04-01T00:00:00.000Z',
      },
    ]);
    const q = new PointInTimeQuery({ reader });
    const all = await q.asOf(
      { firmId: FIRM, engagementId: ENG },
      '2030-06-01T00:00:00.000Z',
      { includeAllStatuses: true },
    );
    expect(all.length).toBe(1);
    expect(all[0]?.validity).toBe('invalidated');
  });

  it('throws on invalid timestamps without consulting the reader', async () => {
    const reader = new CountingReader([]);
    const q = new PointInTimeQuery({ reader });
    await expect(
      q.asOf({ firmId: FIRM, engagementId: ENG }, 'not-a-date'),
    ).rejects.toThrow();
    expect(reader.calls).toBe(0);
  });
});
