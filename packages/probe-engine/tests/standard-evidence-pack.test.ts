// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import {
  ExternalAuditEvidenceRunner,
} from '../src/external-runner.js';
import {
  STANDARD_EVIDENCE_PACK,
  buildStandardEvidencePack,
} from '../src/checks/standard-evidence-pack.js';
import {
  buildMcpConformancePack,
  MCP_CONFORMANCE_CATALOGUE,
} from '../src/checks/mcp-conformance/index.js';

interface SidecarRun {
  runId: string;
  status: 'pass' | 'fail';
}

function makeRunner(plan: SidecarRun): ExternalAuditEvidenceRunner {
  let runId: string | null = null;
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    if (url.endsWith('/checks/run') && init?.method === 'POST') {
      runId = plan.runId;
      return new Response(JSON.stringify({ run_id: runId }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    }
    if (url.includes('/checks/runs/')) {
      const body = {
        run_id: runId ?? plan.runId,
        check_id: 'AC-01',
        state: 'complete',
        started_at: '2026-05-10T00:00:00.000Z',
        updated_at: '2026-05-10T00:00:01.000Z',
        metrics: { calls: 1, tokens: 0, usd: 0, wall_seconds: 0.05 },
        partial_findings: [],
        result: {
          run_id: runId ?? plan.runId,
          check_id: 'AC-01',
          status: plan.status,
          severity: plan.status === 'pass' ? 'info' : 'high',
          findings: [],
          metrics: { calls: 1, tokens: 0, usd: 0, wall_seconds: 0.05 },
          evidence_artifacts: [],
          timestamp_iso: '2026-05-10T00:00:01.000Z',
          terminated_by_budget: false,
        },
      };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  }) as unknown as typeof fetch;

  return new ExternalAuditEvidenceRunner({
    baseUrl: 'http://sidecar.test',
    fetchImpl,
  });
}

describe('STANDARD_EVIDENCE_PACK', () => {
  it('declares one entry per AC-XX sidecar id', () => {
    const ids = STANDARD_EVIDENCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual(['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06', 'AC-07']);
    for (const e of STANDARD_EVIDENCE_PACK) {
      expect(e.probeId).toMatch(/^P-AEAC-0\d$/);
    }
  });

  it('builds probe definitions that translate sidecar pass into ProbeRunResult.pass', async () => {
    const runner = makeRunner({ runId: 'run-pass', status: 'pass' });
    const probes = buildStandardEvidencePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
      defaultSandbox: { network_allowlist: ['audit.test'] },
      pollIntervalMs: 5,
      pollTimeoutMs: 1_000,
    });
    expect(probes).toHaveLength(7);

    const ctx = {
      engagementId: 'eng-1',
      executionId: 'exec-1',
      mode: 'live' as const,
      random: () => 0.5,
      inferenceClient: null,
      deadlineMs: Date.now() + 30_000,
      log: () => undefined,
    };
    const result = await probes[0].run(ctx, { params: {} });
    expect(result.verdict).toBe('pass');
    expect(result.derivedMetrics.checkId).toBe('AC-01');
  });

  it('translates sidecar fail into ProbeRunResult.fail', async () => {
    const runner = makeRunner({ runId: 'run-fail', status: 'fail' });
    const probes = buildStandardEvidencePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
      pollIntervalMs: 5,
      pollTimeoutMs: 1_000,
    });
    const ctx = {
      engagementId: 'eng-1',
      executionId: 'exec-1',
      mode: 'live' as const,
      random: () => 0,
      inferenceClient: null,
      deadlineMs: Date.now() + 30_000,
      log: () => undefined,
    };
    const result = await probes[1].run(ctx, { params: {} });
    expect(result.verdict).toBe('fail');
  });
});

describe('MCP_CONFORMANCE_CATALOGUE', () => {
  it('declares one entry per P-MCP-0X sidecar id', () => {
    const ids = MCP_CONFORMANCE_CATALOGUE.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-MCP-01',
      'P-MCP-02',
      'P-MCP-03',
      'P-MCP-04',
      'P-MCP-05',
      'P-MCP-06',
      'P-MCP-07',
      'P-MCP-08',
    ]);
    for (const e of MCP_CONFORMANCE_CATALOGUE) {
      expect(e.probeId).toMatch(/^P-AEMCP-0\d$/);
    }
  });

  it('buildMcpConformancePack returns 8 probe definitions', () => {
    const runner = makeRunner({ runId: 'r', status: 'pass' });
    const probes = buildMcpConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'mcp', endpoint: 'https://audit.test' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
    });
    expect(probes).toHaveLength(8);
    const probeIds = probes.map((p) => p.meta.id).sort();
    expect(probeIds).toEqual([
      'P-AEMCP-01',
      'P-AEMCP-02',
      'P-AEMCP-03',
      'P-AEMCP-04',
      'P-AEMCP-05',
      'P-AEMCP-06',
      'P-AEMCP-07',
      'P-AEMCP-08',
    ]);
  });
});
