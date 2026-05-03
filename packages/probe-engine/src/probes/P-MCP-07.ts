// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-07 — Cross-server session isolation.
 *
 * Verifies sessions on one MCP server do not leak context into another. Two
 * checks:
 *   (a) `sessionScopedToServer` flag is true on every observed snapshot.
 *   (b) No session record reports `contextLeakageDetected = true`.
 *
 * Maps to: A.6.2.7 (security), A.10.3 (suppliers).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_07_FIXTURES } from './P-MCP-07.fixtures.js';

export interface IsolationResult {
  readonly serversWithoutScoping: readonly string[];
  readonly leakingSessions: readonly string[];
  readonly valid: boolean;
}

export function runIsolationProbe(
  snapshots: readonly McpServerSnapshot[],
): IsolationResult {
  const noScope = snapshots.filter((s) => !s.sessionScopedToServer).map((s) => s.serverId);
  const leaks: string[] = [];
  for (const s of snapshots) {
    for (const sess of s.sessions) {
      if (sess.contextLeakageDetected) leaks.push(sess.sessionId);
    }
  }
  return {
    serversWithoutScoping: Object.freeze(noScope),
    leakingSessions: Object.freeze(leaks),
    valid: noScope.length === 0 && leaks.length === 0,
  };
}

const Params = z.object({
  snapshots: z.array(McpServerSnapshotSchema).optional(),
});

export const P_MCP_07 = defineProbe<z.infer<typeof Params>, IsolationResult>({
  meta: {
    id: 'P-MCP-07',
    name: 'MCP cross-server session isolation',
    description: 'Verifies that sessions on one MCP server cannot leak context into another and that isolation is declared and observed.',
    version: '0.1.0',
    category: 'leakage',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.10.3'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 64, cpuMaxMs: 1_000 },
    references: [{ title: 'MCP session isolation guidance' }],
    groundTruthFixturePath: 'src/probes/P-MCP-07.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'isolation', 'sessions'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshots = (params.snapshots ?? P_MCP_07_FIXTURES.isolated) as readonly McpServerSnapshot[];
    const r = runIsolationProbe(snapshots);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        serversWithoutScoping: r.serversWithoutScoping.length,
        leakingSessions: r.leakingSessions.length,
      },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_07_FIXTURES };
