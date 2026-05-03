// SPDX-License-Identifier: BUSL-1.1
import { beforeEach, describe, expect, it } from 'vitest';

import { bearer, buildFixture, type Fixture } from './helpers.js';
import { canonicalJson, hashParams } from '../src/audit.js';

let f: Fixture;
beforeEach(() => {
  f = buildFixture();
});

describe('audit logging', () => {
  it('emits a ledger event for every successful tool call', async () => {
    await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'get_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(f.ledger.events).toHaveLength(1);
    const ev = f.ledger.events[0]!;
    expect(ev.verdict).toBe('allowed');
    expect(ev.tool).toBe('get_engagement');
    expect(ev.actorId).toBe('auditor-lead-1');
    expect(ev.firmId).toBe('firm-cb-1');
    expect(ev.engagementId).toBe('eng-acme-001');
    expect(ev.paramsHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ev.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('emits a denied event for cross-tenant access (without leaking engagement existence)', async () => {
    await f.server.callTool({
      authorization: bearer(f.tokens.foreign!),
      toolName: 'get_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    const ev = f.ledger.events[0]!;
    expect(ev.verdict).toBe('denied');
    expect(ev.errorCode).toBe('mcp.rbac.cross_tenant');
    expect(ev.actorId).toBe('auditor-lead-2');
    expect(ev.firmId).toBe('firm-cb-2');
  });

  it('emits an auth.denied event for missing authorization', async () => {
    await f.server.callTool({
      authorization: null,
      toolName: 'list_engagements',
      args: {},
    });
    expect(f.ledger.events).toHaveLength(1);
    expect(f.ledger.events[0]!.type).toBe('mcp.auth.denied');
    expect(f.ledger.events[0]!.actorId).toBeNull();
  });

  it('emits one ledger event per call (no duplicates, no drops)', async () => {
    for (let i = 0; i < 5; i++) {
      await f.server.callTool({
        authorization: bearer(f.tokens.lead!),
        toolName: 'list_engagements',
        args: {},
      });
    }
    expect(f.ledger.events).toHaveLength(5);
  });

  it('emits an llm_invocations row when summarize_engagement is called', async () => {
    await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'summarize_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(f.ledger.llmEntries).toHaveLength(1);
    const e = f.ledger.llmEntries[0]!;
    expect(e.purpose).toBe('mcp.summarize_engagement');
    expect(e.engagementId).toBe('eng-acme-001');
    expect(e.tier).toBe('medium');
    expect(e.invocationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(e.occurredAt).toMatch(/Z$/);
  });

  it('canonicalJson produces sorted-key, deterministic output', () => {
    const a = canonicalJson({ b: 1, a: 2 });
    const b = canonicalJson({ a: 2, b: 1 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":2,"b":1}');
  });

  it('hashParams is sha256 hex and identical for equivalent inputs', () => {
    const h1 = hashParams({ a: 1, b: [2, 3] });
    const h2 = hashParams({ b: [2, 3], a: 1 });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not log the raw token (only tokenId/jti from claims)', async () => {
    await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'list_engagements',
      args: {},
    });
    const ev = f.ledger.events[0]!;
    // tokenId on the event is the jti (claim), not the raw token string used
    // by the test gateway.
    expect(ev.tokenId).toBe('tok-lead-1');
    // We never persist the raw token on the principal nor on the event.
    expect(JSON.stringify(ev)).not.toContain('Bearer ');
  });
});
