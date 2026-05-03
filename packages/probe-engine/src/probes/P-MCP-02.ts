// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-02 — MCP server allowlist verification.
 *
 * Verifies the auditee's MCP gateway / orchestrator enforces a trusted-server
 * allowlist. A server reachable from a model client that isn't on the
 * allowlist is treated as a finding (untrusted-server connectivity).
 *
 * Maps to: A.10.3 (suppliers), A.6.2.7 (security).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_02_FIXTURES } from './P-MCP-02.fixtures.js';

export interface AllowlistResult {
  readonly observedServerIds: readonly string[];
  readonly allowlist: readonly string[];
  readonly unauthorized: readonly string[];
  readonly enforcementDeclared: boolean;
  readonly valid: boolean;
}

export function runAllowlistProbe(
  snapshots: readonly McpServerSnapshot[],
  allowlist: readonly string[],
): AllowlistResult {
  const observedServerIds = snapshots.map((s) => s.serverId);
  const set = new Set(allowlist);
  const unauthorized = observedServerIds.filter((id) => !set.has(id));
  const enforcementDeclared = snapshots.every((s) => s.gatewayPolicyEnforced);
  return {
    observedServerIds: Object.freeze(observedServerIds),
    allowlist: Object.freeze([...allowlist]),
    unauthorized: Object.freeze(unauthorized),
    enforcementDeclared,
    valid: unauthorized.length === 0 && enforcementDeclared,
  };
}

const Params = z.object({
  snapshots: z.array(McpServerSnapshotSchema).optional(),
  allowlist: z.array(z.string().min(1)).optional(),
});

export const P_MCP_02 = defineProbe<z.infer<typeof Params>, AllowlistResult>({
  meta: {
    id: 'P-MCP-02',
    name: 'MCP server allowlist verification',
    description:
      'Verifies the auditee enforces a trusted-server allowlist for MCP and that no observed server is outside the list.',
    version: '0.1.0',
    category: 'composite',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.10.3', 'A.6.2.7'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 10_000, memoryMaxMb: 64, cpuMaxMs: 2_000 },
    references: [{ title: '2026 MCP roadmap — gateway policies' }],
    groundTruthFixturePath: 'src/probes/P-MCP-02.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'allowlist', 'supplier'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshots = (params.snapshots ?? P_MCP_02_FIXTURES.clean.snapshots) as readonly McpServerSnapshot[];
    const allowlist = params.allowlist ?? P_MCP_02_FIXTURES.clean.allowlist;
    const r = runAllowlistProbe(snapshots, allowlist);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        observed: r.observedServerIds.length,
        unauthorizedCount: r.unauthorized.length,
        enforcementDeclared: r.enforcementDeclared,
      },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_02_FIXTURES };
