// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it, vi } from 'vitest';
import { SearchService } from './search.service.js';

interface AuditAppendInput {
  firmId: string;
  type: string;
  payload: Record<string, unknown>;
  requestId?: string;
}

class FakeLedger {
  appended: AuditAppendInput[] = [];
  async append(input: AuditAppendInput): Promise<unknown> {
    this.appended.push(input);
    return { id: 'evt-1' };
  }
}

function createService(): { svc: SearchService; ledger: FakeLedger } {
  const ledger = new FakeLedger();
  const sql = { unsafe: vi.fn(async () => []) };
  const svc = new SearchService(
    {} as never,
    sql as never,
    ledger as never,
  );
  // Stub the engine so we don't hit Meilisearch / Ollama.
  (svc as unknown as { engine: { search: unknown; searchKeyword: unknown; searchSemantic: unknown } }).engine = {
    search: vi.fn(async () => ({ hits: [{ id: 'a', scope: 'all', score: 1, payload: {} }], totalEstimated: 1, tookMs: 1, modes: ['hybrid'] })),
    searchKeyword: vi.fn(async () => ({ hits: [], totalEstimated: 0, tookMs: 1, modes: ['keyword'] })),
    searchSemantic: vi.fn(async () => ({ hits: [], totalEstimated: 0, tookMs: 1, modes: ['semantic'] })),
  };
  return { svc, ledger };
}

describe('SearchService ledger emission', () => {
  it('emits a search.executed ledger event on hybrid', async () => {
    const { svc, ledger } = createService();
    await svc.hybrid(
      { q: 'access control', scope: 'all', k: 10 },
      { firmId: 'f1', engagementId: 'e1', auditorId: 'aud1', requestId: 'r1' },
    );
    expect(ledger.appended).toHaveLength(1);
    const evt = ledger.appended[0]!;
    expect(evt.firmId).toBe('f1');
    expect(evt.type).toBe('search.executed');
    expect(evt.payload['mode']).toBe('hybrid');
    expect(evt.payload['scope']).toBe('all');
    expect(evt.payload['resultCount']).toBe(1);
    expect(typeof evt.payload['queryHash']).toBe('string');
  });

  it('emits ledger event for keyword and semantic modes', async () => {
    const { svc, ledger } = createService();
    await svc.keyword({ q: 'x', scope: 'questions', k: 5 }, { firmId: 'f', engagementId: 'e', auditorId: 'a' });
    await svc.semantic({ q: 'x', scope: 'questions', k: 5 }, { firmId: 'f', engagementId: 'e', auditorId: 'a' });
    expect(ledger.appended.map((e) => e.payload['mode'])).toEqual(['keyword', 'semantic']);
  });

  it('hashes the query and never logs the raw text', async () => {
    const { svc, ledger } = createService();
    await svc.hybrid(
      { q: 'sensitive secret-payload', scope: 'all', k: 10 },
      { firmId: 'f', engagementId: 'e', auditorId: 'a' },
    );
    const evt = ledger.appended[0]!;
    expect(JSON.stringify(evt.payload)).not.toContain('sensitive');
    expect(JSON.stringify(evt.payload)).not.toContain('secret');
  });

  it('survives a ledger append failure without throwing', async () => {
    const { svc, ledger } = createService();
    ledger.append = async () => {
      throw new Error('ledger down');
    };
    await expect(
      svc.hybrid({ q: 'x', scope: 'all', k: 10 }, { firmId: 'f', engagementId: 'e', auditorId: 'a' }),
    ).resolves.toBeDefined();
  });
});
