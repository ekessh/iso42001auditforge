// SPDX-License-Identifier: BUSL-1.1
//
// Pure-typing smoke tests for the Drizzle adapters. We don't spin up a real
// Postgres in the unit tier (that's covered by the per-phase integration
// suite); we only assert shape conformance and that the adapters are
// constructible against a stubbed Drizzle client.

import { describe, expect, it } from 'vitest';
import {
  DrizzleConsentRegistry,
  DrizzleCostEventSink,
  DrizzleCostStore,
  DrizzleInvocationLedgerSink,
} from '../src/db/drizzle-adapters.js';
import type { CostEvent } from '@auditforge/cost-controller';

const captured: { sql: string; values: unknown }[] = [];

function fakeChain(): any {
  const obj: any = {};
  obj.values = (v: unknown) => {
    captured.push({ sql: 'insert', values: v });
    return Promise.resolve();
  };
  obj.set = () => obj;
  obj.where = () => obj;
  obj.orderBy = () => {
    // WHY: orderBy needs to be both a chain step and the terminal awaitable;
    // returning a thenable-with-limit covers both call patterns.
    const p: any = Promise.resolve([]);
    p.limit = () => Promise.resolve([]);
    return p;
  };
  obj.limit = () => Promise.resolve([]);
  obj.from = () => obj;
  obj.$dynamic = () => obj;
  return obj;
}

const fakeDb: any = {
  insert: () => fakeChain(),
  update: () => fakeChain(),
  select: () => fakeChain(),
};

describe('Drizzle adapters', () => {
  it('DrizzleInvocationLedgerSink.insert sends a row', async () => {
    captured.length = 0;
    const sink = new DrizzleInvocationLedgerSink(fakeDb);
    await sink.insert({
      id: '00000000-0000-4000-8000-000000000001',
      firmId: '00000000-0000-4000-8000-0000000000fe',
      engagementId: '00000000-0000-4000-8000-0000000000aa',
      task: 'attribution_rerank',
      tier: 'medium',
      provider: 'ollama',
      modelName: 'llama3.1:8b',
      modelHash: 'sha256:abcd',
      promptTemplateVersion: 'attribution-rerank.v1',
      promptTemplateId: 'attribution-rerank',
      promptTemplateHash: 'sha256:templ',
      inputTokens: 12,
      outputTokens: 7,
      latencyMs: 120,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(captured.length).toBe(1);
    const row = captured[0]?.values as Record<string, unknown>;
    expect(row['provider']).toBe('ollama');
    expect(row['promptTemplateHash']).toBe('sha256:templ');
  });

  it('DrizzleCostStore.getSpent returns 0 when ledger is empty', async () => {
    const store = new DrizzleCostStore(fakeDb, async () => null);
    const spent = await store.getSpent('00000000-0000-4000-8000-0000000000aa');
    expect(spent).toBe(0);
  });

  it('DrizzleCostStore.addSpend is a no-op (single-sourced bookkeeping)', async () => {
    const store = new DrizzleCostStore(fakeDb, async () => null);
    const result = await store.addSpend('00000000-0000-4000-8000-0000000000aa', 5);
    expect(result).toBe(0);
  });

  it('DrizzleCostEventSink writes the snapshot fields', async () => {
    captured.length = 0;
    const sink = new DrizzleCostEventSink(
      fakeDb,
      async () => '00000000-0000-4000-8000-0000000000fe',
    );
    const event: CostEvent = {
      name: 'llm.budget.warning',
      engagementId: '00000000-0000-4000-8000-0000000000aa',
      snapshot: {
        engagementId: '00000000-0000-4000-8000-0000000000aa',
        capUsd: 100,
        spentUsd: 80,
        projectedUsd: 81,
        utilization: 0.81,
        warned: true,
        exceeded: false,
      },
      at: '2025-05-10T00:00:00.000Z',
    };
    await sink.emit(event);
    const row = captured[0]?.values as Record<string, unknown>;
    expect(row['event']).toBe('llm.budget.warning');
    expect(row['utilization']).toBe(0.81);
  });

  it('DrizzleConsentRegistry.list returns the empty array against the fake db', async () => {
    const reg = new DrizzleConsentRegistry(fakeDb);
    const all = await reg.list('00000000-0000-4000-8000-0000000000aa');
    expect(all).toEqual([]);
  });

  it('DrizzleConsentRegistry.findActive returns null when no rows match', async () => {
    const reg = new DrizzleConsentRegistry(fakeDb);
    const r = await reg.findActive({
      engagementId: '00000000-0000-4000-8000-0000000000aa',
      providerName: 'anthropic',
    });
    expect(r).toBeNull();
  });
});
