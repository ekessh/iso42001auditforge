// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { buildFixture, bearer } from './helpers.js';

describe('MCP wave 3 tools (Phase 14/15)', () => {
  it('clause.lookup returns a clause with requirements + evidence types', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'clause.lookup',
      args: { clauseId: 'A.7.4' },
    });
    expect(res.ok).toBe(true);
    const out = res.result as {
      id: string;
      framework: string;
      requirements: string[];
      commonEvidenceTypes: string[];
    };
    expect(out.id).toBe('A.7.4');
    expect(out.framework).toBe('ANNEX_A');
    expect(out.requirements.length).toBeGreaterThan(0);
    expect(out.commonEvidenceTypes.length).toBeGreaterThan(0);
  });

  it('clause.lookup returns null for unknown clause', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'clause.lookup',
      args: { clauseId: 'Z.99.99' },
    });
    expect(res.ok).toBe(true);
    expect(res.result).toBeNull();
  });

  it('clause.lookup is allowed for technical experts (catalogue is global)', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.technical),
      toolName: 'clause.lookup',
      args: { clauseId: '6.1' },
    });
    expect(res.ok).toBe(true);
  });

  it('clause.lookup denies auditee role', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.auditee),
      toolName: 'clause.lookup',
      args: { clauseId: '6.1' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('memory.query returns firm-scoped patterns only', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'memory.query',
      args: {},
    });
    expect(res.ok).toBe(true);
    const out = res.result as Array<{ firmId: string }>;
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.firmId === 'firm-cb-1')).toBe(true);
  });

  it('memory.query filters by kind and scope', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'memory.query',
      args: { kind: 'clause_evidence_failure_rate', scope: { industry: 'healthcare' } },
    });
    expect(res.ok).toBe(true);
    const out = res.result as Array<{ patternKind: string; dimensions: Record<string, string> }>;
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((p) => p.patternKind === 'clause_evidence_failure_rate')).toBe(true);
    expect(out.every((p) => p.dimensions.industry === 'healthcare')).toBe(true);
  });

  it('memory.query denies team auditor role (lead/manager only)', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.peer),
      toolName: 'memory.query',
      args: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('memory.export without confirmation prefix is rejected', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'memory.export',
      args: { confirmationToken: 'confirm-token-valid' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.tool.confirmation_required');
  });

  it('memory.export with valid confirmation returns a signed receipt + firm patterns', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'memory.export',
      args: { confirmationToken: 'confirm-mem-export-1' },
    });
    expect(res.ok).toBe(true);
    const out = res.result as {
      firmId: string;
      patternCount: number;
      patterns: Array<{ firmId: string }>;
      signature: { algorithm: string; signatureBase64: string };
    };
    expect(out.firmId).toBe('firm-cb-1');
    expect(out.patternCount).toBeGreaterThan(0);
    expect(out.patterns.every((p) => p.firmId === 'firm-cb-1')).toBe(true);
    expect(out.signature.algorithm).toBe('Ed25519');
    expect(out.signature.signatureBase64.length).toBeGreaterThan(0);
  });

  it('memory.export denies non-lead role', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.manager),
      toolName: 'memory.export',
      args: { confirmationToken: 'confirm-mem-export-1' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('aiSystemInventory.profile returns the rich self-profile (CLAUDE.md hard rule)', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'aiSystemInventory.profile',
      args: {},
    });
    expect(res.ok).toBe(true);
    const out = res.result as {
      modelName: string;
      displayName: string;
      toolsExposed: string[];
      modelsUsedDownstream: string[];
      knownBiases: string[];
      auditRetention: string;
      outOfScopeUse: string[];
      governance: { confirmationRequired: string[] };
    };
    expect(out.modelName).toBe('auditforge-mcp');
    expect(out.displayName).toMatch(/AuditForge/);
    expect(out.toolsExposed).toContain('clause.lookup');
    expect(out.toolsExposed).toContain('memory.query');
    expect(out.toolsExposed).toContain('memory.export');
    expect(out.toolsExposed).toContain('aiSystemInventory.profile');
    expect(out.modelsUsedDownstream.some((m) => /Ollama|vLLM|llama\.cpp/.test(m))).toBe(true);
    expect(out.knownBiases.length).toBeGreaterThan(0);
    expect(out.auditRetention).toMatch(/Ed25519/);
    expect(out.outOfScopeUse.some((s) => /offensive testing/i.test(s))).toBe(true);
    expect(out.governance.confirmationRequired).toContain('report.publish');
    expect(out.governance.confirmationRequired).toContain('memory.export');
  });

  it('every tool emits a ledger event with correct verdict on success', async () => {
    const f = buildFixture();
    f.ledger.reset();
    await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'clause.lookup',
      args: { clauseId: 'A.7.4' },
    });
    const ev = f.ledger.events.find((e) => e.tool === 'clause.lookup');
    expect(ev?.verdict).toBe('allowed');
    expect(ev?.firmId).toBe('firm-cb-1');
  });
});
