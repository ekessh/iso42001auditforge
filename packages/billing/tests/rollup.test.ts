// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { rollup } from '../src/rollup.js';
import { fxConvert } from '../src/fx.js';

const fx = fxConvert({ USD: 1.0, EUR: 0.92 });

describe('rollup', () => {
  it('aggregates billable hours and labor', () => {
    const r = rollup({
      engagementId: 'e1',
      timeEntries: [
        { id: 't1', firmId: 'f', engagementId: 'e1', auditorId: 'a', category: 'planning', startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-01T01:00:00Z', minutes: 60, source: 'timer' },
        { id: 't2', firmId: 'f', engagementId: 'e1', auditorId: 'a', category: 'stage2_onsite', startAt: '2026-01-02T00:00:00Z', endAt: '2026-01-02T08:00:00Z', minutes: 480, source: 'manual' },
      ],
      expenses: [{ id: 'x', firmId: 'f', engagementId: 'e1', auditorId: 'a', amount: 200, currency: 'USD', category: 'travel', description: 'flight', receiptEvidenceId: null, occurredAt: '2026-01-01T00:00:00Z' }],
      rateCard: [
        { category: 'planning', hourlyRate: 200, currency: 'USD' },
        { category: 'stage2_onsite', hourlyRate: 250, currency: 'USD' },
      ],
      currency: 'USD',
      fx,
    });
    expect(r.hoursByCategory.planning).toBe(1);
    expect(r.hoursByCategory.stage2_onsite).toBe(8);
    expect(r.laborByCategory.planning).toBe(200);
    expect(r.laborByCategory.stage2_onsite).toBe(2000);
    expect(r.expenses).toBe(200);
    expect(r.grandTotal).toBe(2400);
  });
  it('ignores entries from other engagements', () => {
    const r = rollup({
      engagementId: 'e1',
      timeEntries: [{ id: 't', firmId: 'f', engagementId: 'e2', auditorId: 'a', category: 'planning', startAt: '2026-01-01T00:00:00Z', endAt: '2026-01-01T01:00:00Z', minutes: 60, source: 'timer' }],
      expenses: [], rateCard: [{ category: 'planning', hourlyRate: 100, currency: 'USD' }], currency: 'USD', fx,
    });
    expect(r.laborTotal).toBe(0);
  });
});
