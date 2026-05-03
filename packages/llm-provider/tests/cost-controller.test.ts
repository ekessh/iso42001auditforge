// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { CostBudgetExceeded, CostController, InMemoryCostStore } from '../src/index.js';

describe('CostController', () => {
  it('allows freely when no budget is set', async () => {
    const store = new InMemoryCostStore();
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 1.0, true);
    expect(d.mode).toBe('allow');
    expect(d.warned).toBe(false);
  });

  it('warns at 80% but still allows', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 7);
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 1, true);
    expect(d.mode).toBe('allow');
    expect(d.warned).toBe(true);
  });

  it('hard-falls-back to local at 100% for cloud calls', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 10);
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 1, true);
    expect(d.mode).toBe('fallback_local');
  });

  it('throws CostBudgetExceeded when local exceeds the cap', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 9.5);
    const ctrl = new CostController(store);
    await expect(ctrl.preflight('e1', 1, false)).rejects.toBeInstanceOf(CostBudgetExceeded);
  });

  it('record() accumulates spend', async () => {
    const store = new InMemoryCostStore();
    const ctrl = new CostController(store);
    expect(await ctrl.record('e1', 1.5)).toBe(1.5);
    expect(await ctrl.record('e1', 0.5)).toBe(2.0);
  });

  it('record() ignores zero or negative deltas', async () => {
    const store = new InMemoryCostStore();
    const ctrl = new CostController(store);
    await ctrl.record('e1', 1);
    expect(await ctrl.record('e1', 0)).toBe(1);
    expect(await ctrl.record('e1', -1)).toBe(1);
  });

  it('does not warn below 80% threshold', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 100 });
    await store.addSpend('e1', 10);
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 5, true);
    expect(d.warned).toBe(false);
  });
});
