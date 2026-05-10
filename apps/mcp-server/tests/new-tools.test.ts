// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { buildFixture, bearer } from './helpers.js';

describe('MCP scaffold tools (Phase 14 wave 2)', () => {
  it('library.search returns hits filtered by clause', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'library.search',
      args: { query: 'data quality', clauseFilter: ['A.7.4'] },
    });
    expect(res.ok).toBe(true);
    const out = res.result as Array<{ id: string; clauseIds: string[] }>;
    expect(out.length).toBe(1);
    expect(out[0]!.id).toBe('Q-DQ-001');
  });

  it('library.search rejects auditee role', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.auditee),
      toolName: 'library.search',
      args: { query: 'anything' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('working-paper.read returns the paper for a member auditor', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'working-paper.read',
      args: { engagementId: 'eng-acme-001', workingPaperId: 'wp-001' },
    });
    expect(res.ok).toBe(true);
    const out = res.result as { id: string; content: string };
    expect(out.id).toBe('wp-001');
    expect(out.content.length).toBeGreaterThan(0);
  });

  it('working-paper.read denies cross-tenant read', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.foreign),
      toolName: 'working-paper.read',
      args: { engagementId: 'eng-acme-001', workingPaperId: 'wp-001' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.cross_tenant');
  });

  it('report.list returns reports for engagement member', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'report.list',
      args: { engagementId: 'eng-acme-001' },
    });
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.result)).toBe(true);
    const arr = res.result as Array<{ id: string }>;
    expect(arr.length).toBe(1);
  });

  it('report.publish without confirmation token is rejected by schema', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'report.publish',
      args: { engagementId: 'eng-acme-001', reportId: 'rep-acme-001' },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.bad_arguments');
  });

  it('report.publish with invalid confirmation token errors with confirmation_required', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'report.publish',
      args: {
        engagementId: 'eng-acme-001',
        reportId: 'rep-acme-001',
        confirmationToken: 'not-the-right-token',
      },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.tool.confirmation_required');
  });

  it('report.publish with valid token publishes and returns a signed receipt', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'report.publish',
      args: {
        engagementId: 'eng-acme-001',
        reportId: 'rep-acme-001',
        confirmationToken: 'confirm-token-valid',
      },
    });
    expect(res.ok).toBe(true);
    const out = res.result as {
      status: string;
      signature: { keyId: string; algorithm: string; signatureBase64: string };
    };
    expect(out.status).toBe('published');
    expect(out.signature.algorithm).toBe('Ed25519');
    expect(out.signature.signatureBase64.length).toBeGreaterThan(0);
  });

  it('report.publish rejects non-lead role', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.peer),
      toolName: 'report.publish',
      args: {
        engagementId: 'eng-acme-001',
        reportId: 'rep-acme-001',
        confirmationToken: 'confirm-token-valid',
      },
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });

  it('aiSystemInventory.profile returns AuditForge self model card', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.lead),
      toolName: 'aiSystemInventory.profile',
      args: {},
    });
    expect(res.ok).toBe(true);
    const out = res.result as {
      modelName: string;
      governance: { confirmationRequired: string[] };
    };
    expect(out.modelName).toBe('auditforge-mcp');
    expect(out.governance.confirmationRequired).toContain('report.publish');
  });

  it('aiSystemInventory.profile is denied for auditee role (auditees go via portal)', async () => {
    const f = buildFixture();
    const res = await f.server.callTool({
      authorization: bearer(f.tokens.auditee),
      toolName: 'aiSystemInventory.profile',
      args: {},
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('mcp.rbac.forbidden');
  });
});
