// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  CostBudgetExceeded,
  CostController,
  InMemoryCostEventSink,
  InMemoryCostStore,
} from '../src/index.js';

describe('CostController', () => {
  it('allows freely when no budget is set', async () => {
    const store = new InMemoryCostStore();
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 1.0, true);
    expect(d.mode).toBe('allow');
    expect(d.warned).toBe(false);
    expect(d.snapshot.capUsd).toBeNull();
  });

  it('warns at 80% utilization', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 7);
    const sink = new InMemoryCostEventSink();
    const ctrl = new CostController(store, { events: sink });
    const d = await ctrl.preflight('e1', 1, true);
    expect(d.mode).toBe('allow');
    expect(d.warned).toBe(true);
    expect(sink.events[0]?.name).toBe('llm.budget.warning');
  });

  it('falls back to local on cloud when projected >= cap', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 10);
    const sink = new InMemoryCostEventSink();
    const ctrl = new CostController(store, { events: sink });
    const d = await ctrl.preflight('e1', 1, true);
    expect(d.mode).toBe('fallback_local');
    expect(sink.events.find((e) => e.name === 'llm.budget.exceeded')).toBeDefined();
  });

  it('throws on local when projected exceeds cap', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 10);
    const ctrl = new CostController(store);
    await expect(ctrl.preflight('e1', 1, false)).rejects.toBeInstanceOf(CostBudgetExceeded);
  });

  it('override token allows cloud past the cap', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 12);
    const ctrl = new CostController(store);
    const d = await ctrl.preflight('e1', 1, true, true);
    expect(d.mode).toBe('allow');
    expect(d.snapshot.exceeded).toBe(true);
  });

  it('record() accumulates non-negative spend only', async () => {
    const store = new InMemoryCostStore();
    const ctrl = new CostController(store);
    expect(await ctrl.record('e1', 1.5)).toBe(1.5);
    expect(await ctrl.record('e1', 0)).toBe(1.5);
    expect(await ctrl.record('e1', -1)).toBe(1.5);
  });

  it('does not re-emit warning until latch reset', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 10 });
    await store.addSpend('e1', 8);
    const sink = new InMemoryCostEventSink();
    const ctrl = new CostController(store, { events: sink });
    await ctrl.preflight('e1', 0.5, true);
    await ctrl.preflight('e1', 0.5, true);
    expect(sink.events.filter((e) => e.name === 'llm.budget.warning').length).toBe(1);
    ctrl.resetEmissionLatch('e1');
    await ctrl.preflight('e1', 0.5, true);
    expect(sink.events.filter((e) => e.name === 'llm.budget.warning').length).toBe(2);
  });

  it('snapshot reports utilization without modifying state', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 100 });
    await store.addSpend('e1', 25);
    const ctrl = new CostController(store);
    const snap = await ctrl.snapshot('e1');
    expect(snap.utilization).toBeCloseTo(0.25);
    expect(snap.warned).toBe(false);
  });

  it('zero-cap budget always reports exceeded', async () => {
    const store = new InMemoryCostStore();
    store.putBudget({ engagementId: 'e1', capUsd: 0 });
    const ctrl = new CostController(store);
    const snap = await ctrl.snapshot('e1');
    expect(snap.utilization).toBe(1);
    expect(snap.exceeded).toBe(true);
  });
});
