// SPDX-License-Identifier: BUSL-1.1
import { beforeEach, describe, expect, it } from 'vitest';

import { bearer, buildFixture, type Fixture } from './helpers.js';

let f: Fixture;
beforeEach(() => {
  f = buildFixture();
});

describe('tool dispatch', () => {
  it('list_engagements returns engagements visible to lead auditor', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'list_engagements',
      args: {},
    });
    expect(r.ok).toBe(true);
    const rows = r.result as Array<{ id: string }>;
    expect(rows.map((x) => x.id).sort()).toEqual(['eng-acme-001', 'eng-bigco-002']);
  });

  it('list_engagements is forbidden for peer_reviewer', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.peer!),
      toolName: 'list_engagements',
      args: {},
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('get_engagement membership-checked: peer can read assigned engagement', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.peer!),
      toolName: 'get_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(true);
    expect((r.result as { id: string }).id).toBe('eng-acme-001');
  });

  it('get_engagement denies peer reading non-member engagement', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.peer!),
      toolName: 'get_engagement',
      args: { engagementId: 'eng-bigco-002' },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.rbac.cross_tenant');
  });

  it('cross-tenant denied: foreign-firm lead cannot list engagements in firm-cb-1', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.foreign!),
      toolName: 'get_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.rbac.cross_tenant');
  });

  it('list_findings filters by status', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'list_findings',
      args: { engagementId: 'eng-acme-001', status: 'closed' },
    });
    expect(r.ok).toBe(true);
    const rows = r.result as Array<{ id: string; status: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('find-002');
  });

  it('get_candidate_findings denied for peer_reviewer', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.peer!),
      toolName: 'get_candidate_findings',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('get_candidate_findings allowed for lead_auditor', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'get_candidate_findings',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(true);
    const rows = r.result as Array<{ id: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe('cand-001');
  });

  it('get_coverage_state allowed for audit_manager', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.manager!),
      toolName: 'get_coverage_state',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(true);
  });

  it('search_claims engagement-scoped: query "*" returns all', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'search_claims',
      args: { engagementId: 'eng-acme-001', query: '*' },
    });
    expect(r.ok).toBe(true);
    expect((r.result as unknown[]).length).toBe(2);
  });

  it('search_claims allowed for technical_expert', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.technical!),
      toolName: 'search_claims',
      args: { engagementId: 'eng-acme-001', query: 'provenance' },
    });
    expect(r.ok).toBe(true);
    // Only claim-001 mentions provenance.
    expect((r.result as unknown[]).length).toBe(1);
  });

  it('summarize_engagement returns recommendation and emits an llm_invocation', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'summarize_engagement',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(r.ok).toBe(true);
    const s = r.result as { recommendation: string; coveragePct: number };
    expect(s.recommendation).toBe('conformity-pending-capa');
    expect(s.coveragePct).toBeGreaterThan(0);
    expect(f.ledger.llmEntries.length).toBe(1);
    expect(f.ledger.llmEntries[0]!.purpose).toBe('mcp.summarize_engagement');
  });

  it('draft_followup_question fetches claim and emits an llm_invocation', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'draft_followup_question',
      args: { engagementId: 'eng-acme-001', claimId: 'claim-001' },
    });
    expect(r.ok).toBe(true);
    const out = r.result as { text: string; mappedClauses: string[]; modelInvocationId: string | null };
    expect(out.text).toContain('training pipeline');
    expect(out.mappedClauses).toContain('A.7.5');
    expect(f.ledger.llmEntries.length).toBe(1);
    expect(f.ledger.llmEntries[0]!.purpose).toBe('mcp.draft_followup_question');
    expect(out.modelInvocationId).toBe(f.ledger.llmEntries[0]!.invocationId);
  });

  it('rejects unknown tool name', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'rm_rf',
      args: {},
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.unknown_tool');
  });

  it('rejects bad arguments', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'get_engagement',
      args: { engagementId: 123 },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('mcp.bad_arguments');
  });

  it('list_engagements filter narrows results', async () => {
    const r = await f.server.callTool({
      authorization: bearer(f.tokens.lead!),
      toolName: 'list_engagements',
      args: { status: 'active' },
    });
    expect(r.ok).toBe(true);
    expect((r.result as unknown[]).length).toBe(1);
  });

  it('listTools surfaces 8 tools with stable fingerprints', () => {
    const tools = f.server.listTools();
    expect(tools).toHaveLength(8);
    for (const t of tools) {
      expect(t.fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(t.description.length).toBeGreaterThan(20);
    }
  });
});
