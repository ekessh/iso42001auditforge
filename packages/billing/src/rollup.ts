// SPDX-License-Identifier: BUSL-1.1
import type { TimeEntry, Expense, RateCardEntry, BillableCategory } from './domain.js';

export interface EngagementRollup {
  engagementId: string;
  hoursByCategory: Record<BillableCategory, number>;
  laborByCategory: Record<BillableCategory, number>;
  expenses: number;
  laborTotal: number;
  grandTotal: number;
  currency: string;
}

const ALL: BillableCategory[] = [
  'planning', 'doc_review', 'stage1_onsite', 'stage2_onsite', 'stage2_remote',
  'probe_execution', 'trace_review', 'reporting', 'peer_review', 'travel', 'admin',
];

export function rollup(opts: {
  engagementId: string;
  timeEntries: TimeEntry[];
  expenses: Expense[];
  rateCard: RateCardEntry[];
  currency: string;
  fx: (amount: number, from: string, to: string) => number;
}): EngagementRollup {
  const hoursByCategory = Object.fromEntries(ALL.map((c) => [c, 0])) as Record<BillableCategory, number>;
  const laborByCategory = Object.fromEntries(ALL.map((c) => [c, 0])) as Record<BillableCategory, number>;
  for (const e of opts.timeEntries) {
    if (e.engagementId !== opts.engagementId) continue;
    const hours = e.minutes / 60;
    hoursByCategory[e.category] += hours;
    const card = opts.rateCard.find((r) => r.category === e.category) ?? null;
    if (!card) continue;
    const laborInCard = hours * card.hourlyRate;
    const laborInTarget = opts.fx(laborInCard, card.currency, opts.currency);
    laborByCategory[e.category] += laborInTarget;
  }

  let expenses = 0;
  for (const ex of opts.expenses) {
    if (ex.engagementId !== opts.engagementId) continue;
    expenses += opts.fx(ex.amount, ex.currency, opts.currency);
  }

  const laborTotal = Object.values(laborByCategory).reduce((s, v) => s + v, 0);
  const grandTotal = laborTotal + expenses;

  return {
    engagementId: opts.engagementId,
    hoursByCategory, laborByCategory,
    expenses, laborTotal, grandTotal, currency: opts.currency,
  };
}
