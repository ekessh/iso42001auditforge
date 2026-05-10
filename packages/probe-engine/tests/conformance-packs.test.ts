// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';

import { ExternalAuditEvidenceRunner } from '../src/external-runner.js';
import {
  AGENT_CONFORMANCE_PACK,
  buildAgentConformancePack,
} from '../src/checks/agent-pack.js';
import {
  CHAIN_CONFORMANCE_PACK,
  buildChainConformancePack,
} from '../src/checks/chain-pack.js';
import {
  DATA_CONFORMANCE_PACK,
  buildDataConformancePack,
} from '../src/checks/data-pack.js';
import {
  GOVERNANCE_CONFORMANCE_PACK,
  buildGovernanceConformancePack,
} from '../src/checks/governance-pack.js';
import {
  LLM_CONFORMANCE_PACK,
  buildLlmConformancePack,
} from '../src/checks/llm-pack.js';
import {
  RISK_CONFORMANCE_PACK,
  buildRiskConformancePack,
} from '../src/checks/risk-pack.js';

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
        check_id: 'P-LLM-01',
        state: 'complete',
        started_at: '2026-05-10T00:00:00.000Z',
        updated_at: '2026-05-10T00:00:01.000Z',
        metrics: { calls: 1, tokens: 0, usd: 0, wall_seconds: 0.05 },
        partial_findings: [],
        result: {
          run_id: runId ?? plan.runId,
          check_id: 'P-LLM-01',
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

const CLAUSE_RE = /^(?:[4-9]|10)(?:\.\d+){0,4}$/;
const ANNEX_RE = /^A\.\d+(?:\.\d+){0,3}$/;

describe('LLM_CONFORMANCE_PACK', () => {
  it('declares one entry per P-LLM-NN sidecar id', () => {
    const ids = LLM_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-LLM-01',
      'P-LLM-02',
      'P-LLM-03',
      'P-LLM-04',
      'P-LLM-05',
      'P-LLM-06',
      'P-LLM-07',
      'P-LLM-08',
      'P-LLM-09',
      'P-LLM-10',
    ]);
    for (const e of LLM_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AELLM-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildLlmConformancePack returns 10 probe definitions and pass-through verdicts', async () => {
    const runner = makeRunner({ runId: 'r-llm', status: 'pass' });
    const probes = buildLlmConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
      pollIntervalMs: 5,
      pollTimeoutMs: 1_000,
    });
    expect(probes).toHaveLength(10);

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
  });
});

describe('DATA_CONFORMANCE_PACK', () => {
  it('declares one entry per P-DATA-NN sidecar id', () => {
    const ids = DATA_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-DATA-01',
      'P-DATA-02',
      'P-DATA-03',
      'P-DATA-04',
      'P-DATA-05',
      'P-DATA-06',
      'P-DATA-07',
      'P-DATA-08',
    ]);
    for (const e of DATA_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AEDATA-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildDataConformancePack returns 8 probes', () => {
    const runner = makeRunner({ runId: 'r-data', status: 'pass' });
    const probes = buildDataConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
    });
    expect(probes).toHaveLength(8);
  });
});

describe('RISK_CONFORMANCE_PACK', () => {
  it('declares one entry per P-RISK-NN sidecar id', () => {
    const ids = RISK_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-RISK-01',
      'P-RISK-02',
      'P-RISK-03',
      'P-RISK-04',
      'P-RISK-05',
      'P-RISK-06',
    ]);
    for (const e of RISK_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AERISK-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildRiskConformancePack returns 6 probes', () => {
    const runner = makeRunner({ runId: 'r-risk', status: 'pass' });
    const probes = buildRiskConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
    });
    expect(probes).toHaveLength(6);
  });
});

describe('GOVERNANCE_CONFORMANCE_PACK', () => {
  it('declares one entry per P-GOV-NN sidecar id', () => {
    const ids = GOVERNANCE_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-GOV-01',
      'P-GOV-02',
      'P-GOV-03',
      'P-GOV-04',
      'P-GOV-05',
      'P-GOV-06',
    ]);
    for (const e of GOVERNANCE_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AEGOV-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildGovernanceConformancePack returns 6 probes', () => {
    const runner = makeRunner({ runId: 'r-gov', status: 'pass' });
    const probes = buildGovernanceConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
    });
    expect(probes).toHaveLength(6);
  });
});

describe('AGENT_CONFORMANCE_PACK', () => {
  it('declares one entry per P-AGENT-NN sidecar id', () => {
    const ids = AGENT_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-AGENT-01',
      'P-AGENT-02',
      'P-AGENT-03',
      'P-AGENT-04',
      'P-AGENT-05',
    ]);
    for (const e of AGENT_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AEAGENT-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildAgentConformancePack returns 5 probes', () => {
    const runner = makeRunner({ runId: 'r-agent', status: 'pass' });
    const probes = buildAgentConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
    });
    expect(probes).toHaveLength(5);
  });
});

describe('CHAIN_CONFORMANCE_PACK', () => {
  it('declares one entry per P-CHAIN-NN sidecar id', () => {
    const ids = CHAIN_CONFORMANCE_PACK.map((e) => e.sidecarCheckId).sort();
    expect(ids).toEqual([
      'P-CHAIN-01',
      'P-CHAIN-02',
      'P-CHAIN-03',
      'P-CHAIN-04',
      'P-CHAIN-05',
    ]);
    for (const e of CHAIN_CONFORMANCE_PACK) {
      expect(e.probeId).toMatch(/^P-AECHAIN-\d{2}$/);
      for (const c of e.clauses) expect(c).toMatch(CLAUSE_RE);
      for (const a of e.annexA) expect(a).toMatch(ANNEX_RE);
    }
  });

  it('buildChainConformancePack returns 5 probes and pass-through fail verdict', async () => {
    const runner = makeRunner({ runId: 'r-chain', status: 'fail' });
    const probes = buildChainConformancePack({
      runner,
      engagementContextJwt: 'jwt',
      defaultTarget: { kind: 'http', endpoint: 'https://audit.test/v1/echo' },
      defaultBudget: { max_seconds: 30, max_calls: 10, max_tokens: 1000, max_usd: 1 },
      pollIntervalMs: 5,
      pollTimeoutMs: 1_000,
    });
    expect(probes).toHaveLength(5);

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
    expect(result.verdict).toBe('fail');
  });
});

describe('total catalogue size', () => {
  it('all six conformance packs sum to 40 probes', () => {
    const total =
      LLM_CONFORMANCE_PACK.length +
      DATA_CONFORMANCE_PACK.length +
      RISK_CONFORMANCE_PACK.length +
      GOVERNANCE_CONFORMANCE_PACK.length +
      AGENT_CONFORMANCE_PACK.length +
      CHAIN_CONFORMANCE_PACK.length;
    expect(total).toBe(40);
  });
});
