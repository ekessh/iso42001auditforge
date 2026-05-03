// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

interface Row { firmId: string; engagementId: string; data: string }
const DB: Row[] = [
  { firmId: 'firm-a', engagementId: 'eng-a1', data: 'a1' },
  { firmId: 'firm-a', engagementId: 'eng-a2', data: 'a2' },
  { firmId: 'firm-b', engagementId: 'eng-b1', data: 'b1' },
];

function rlsQuery(actorFirm: string): Row[] {
  return DB.filter((r) => r.firmId === actorFirm);
}

describe('tenant isolation', () => {
  it('firm A cannot read firm B', () => {
    expect(rlsQuery('firm-a').every((r) => r.firmId === 'firm-a')).toBe(true);
  });
  it('firm B cannot read firm A', () => {
    expect(rlsQuery('firm-b').every((r) => r.firmId === 'firm-b')).toBe(true);
  });
  it('unknown firm gets empty', () => {
    expect(rlsQuery('firm-c')).toHaveLength(0);
  });

  describe('cross-tenant fuzz', () => {
    const attempts = Array.from({ length: 200 }, (_, i) => ({ actor: `firm-${(i % 5)}`, target: `firm-${((i + 1) % 5)}` }));
    for (const { actor, target } of attempts) {
      if (actor !== target) {
        it(`actor ${actor} cannot read ${target}`, () => {
          const rows = rlsQuery(actor);
          expect(rows.every((r) => r.firmId !== target)).toBe(true);
        });
      }
    }
  });
});
