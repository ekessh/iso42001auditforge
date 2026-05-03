// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-08 — Gateway policy enforcement verification.
 *
 * Active probe: synthesizes a denied request and checks the gateway both (a)
 * blocks it and (b) writes the denial to the audit trail. A gateway that
 * silently succeeds, or denies but doesn't log, is a finding.
 *
 * The probe consumes a `GatewayProbeOutcome` per attempt rather than calling
 * the gateway live, so it stays deterministic and offline-safe.
 *
 * Maps to: A.6.2.7 (security), A.6.2.8 (event logging), A.10.3 (suppliers).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_08_FIXTURES } from './P-MCP-08.fixtures.js';

export interface GatewayProbeOutcome {
  readonly attemptId: string;
  readonly expectedVerdict: 'denied';
  readonly observedVerdict: 'allowed' | 'denied' | 'error';
  readonly auditRowFound: boolean;
}

export interface GatewayPolicyResult {
  readonly attempts: number;
  readonly allowedThatShouldBeDenied: readonly string[];
  readonly missingAuditRows: readonly string[];
  readonly enforcementDeclared: boolean;
  readonly valid: boolean;
}

export function runGatewayPolicyProbe(
  snapshot: McpServerSnapshot,
  outcomes: readonly GatewayProbeOutcome[],
): GatewayPolicyResult {
  const allowedFails = outcomes
    .filter((o) => o.expectedVerdict === 'denied' && o.observedVerdict !== 'denied')
    .map((o) => o.attemptId);
  const missingLogs = outcomes
    .filter((o) => o.observedVerdict === 'denied' && !o.auditRowFound)
    .map((o) => o.attemptId);
  return {
    attempts: outcomes.length,
    allowedThatShouldBeDenied: Object.freeze(allowedFails),
    missingAuditRows: Object.freeze(missingLogs),
    enforcementDeclared: snapshot.gatewayPolicyEnforced,
    valid:
      snapshot.gatewayPolicyEnforced &&
      allowedFails.length === 0 &&
      missingLogs.length === 0,
  };
}

const Params = z.object({
  snapshot: McpServerSnapshotSchema.optional(),
  outcomes: z
    .array(
      z.object({
        attemptId: z.string().min(1),
        expectedVerdict: z.literal('denied'),
        observedVerdict: z.enum(['allowed', 'denied', 'error']),
        auditRowFound: z.boolean(),
      }),
    )
    .optional(),
});

export const P_MCP_08 = defineProbe<z.infer<typeof Params>, GatewayPolicyResult>({
  meta: {
    id: 'P-MCP-08',
    name: 'MCP gateway policy enforcement verification',
    description: 'Verifies the MCP gateway blocks requests that should be denied and logs every denial to the audit trail.',
    version: '0.1.0',
    category: 'composite',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.6.2.8', 'A.10.3'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 10_000, memoryMaxMb: 64, cpuMaxMs: 2_000 },
    references: [{ title: '2026 MCP roadmap — gateway policies and audit logging' }],
    groundTruthFixturePath: 'src/probes/P-MCP-08.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'gateway', 'policy'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_08_FIXTURES.passing.snapshot) as McpServerSnapshot;
    const outcomes = params.outcomes ?? P_MCP_08_FIXTURES.passing.outcomes;
    const r = runGatewayPolicyProbe(snapshot, outcomes);
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: {
        attempts: r.attempts,
        allowedThatShouldBeDenied: r.allowedThatShouldBeDenied.length,
        missingAuditRows: r.missingAuditRows.length,
        enforcementDeclared: r.enforcementDeclared,
      },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_08_FIXTURES };
