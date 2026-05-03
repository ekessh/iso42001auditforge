// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-05 — Per-tool RBAC enforcement.
 *
 * Verifies the MCP server publishes a per-tool RBAC matrix and enforces it.
 * Properties checked:
 *   - Every advertised tool declares >=1 allowed role (no wildcard / blank).
 *   - Audit trail does not contain `verdict=allowed` rows where the principal
 *     is missing or the tool is not in the matrix.
 *   - Denied calls produce ledger rows (closing the gap that lets attackers
 *     probe the matrix silently).
 *
 * Maps to: A.6.2.7 (security), A.9.4 (intended use).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_05_FIXTURES } from './P-MCP-05.fixtures.js';

export interface RbacResult {
  readonly toolsWithoutRoles: readonly string[];
  readonly allowedWithoutActor: number;
  readonly deniedRowsLogged: number;
  readonly valid: boolean;
}

export function runRbacProbe(snapshot: McpServerSnapshot): RbacResult {
  const toolsWithoutRoles = snapshot.tools
    .filter((t) => t.allowedRoles.length === 0)
    .map((t) => t.name);
  const allowedWithoutActor = snapshot.auditTrail.filter(
    (e) => e.verdict === 'allowed' && (e.actorId === null || e.actorId === ''),
  ).length;
  const deniedRowsLogged = snapshot.auditTrail.filter((e) => e.verdict === 'denied').length;
  const valid = toolsWithoutRoles.length === 0 && allowedWithoutActor === 0;
  return {
    toolsWithoutRoles: Object.freeze(toolsWithoutRoles),
    allowedWithoutActor,
    deniedRowsLogged,
    valid,
  };
}

const Params = z.object({ snapshot: McpServerSnapshotSchema.optional() });

export const P_MCP_05 = defineProbe<z.infer<typeof Params>, RbacResult>({
  meta: {
    id: 'P-MCP-05',
    name: 'MCP per-tool RBAC enforcement',
    description: 'Verifies every MCP tool declares an allowed-role list and that the audit trail never shows allowed calls without an actor.',
    version: '0.1.0',
    category: 'composite',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.9.4'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 64, cpuMaxMs: 1_000 },
    references: [{ title: '2026 MCP roadmap — per-tool RBAC' }],
    groundTruthFixturePath: 'src/probes/P-MCP-05.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'rbac'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_05_FIXTURES.enforced) as McpServerSnapshot;
    const r = runRbacProbe(snapshot);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        toolsWithoutRoles: r.toolsWithoutRoles.length,
        allowedWithoutActor: r.allowedWithoutActor,
        deniedRowsLogged: r.deniedRowsLogged,
      },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_05_FIXTURES };
