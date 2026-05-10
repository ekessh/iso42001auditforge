// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  CostController,
  InMemoryCostEventSink,
  InMemoryCostStore,
} from '../src/index.js';

describe('budget event ledger emission', () => {
  it('emits llm.budget.warning at 80% threshold', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 8);
    const events = new InMemoryCostEventSink();
    const ctrl = new CostController(store, { events });
    await ctrl.preflight('e1', 0.5, true);
    expect(events.events.map((e) => e.name)).toEqual(['llm.budget.warning']);
  });

  it('emits llm.budget.exceeded once at 100%', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 10);
    const events = new InMemoryCostEventSink();
    const ctrl = new CostController(store, { events });
    await ctrl.preflight('e1', 0.5, true);
    await ctrl.preflight('e1', 0.5, true);
    expect(events.events.filter((e) => e.name === 'llm.budget.exceeded').length).toBe(1);
  });

  it('snapshot reflects exceeded state without consuming spend', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 12);
    const ctrl = new CostController(store);
    const snap = await ctrl.snapshot('e1');
    expect(snap.exceeded).toBe(true);
    expect(snap.spentUsd).toBe(12);
  });
});
