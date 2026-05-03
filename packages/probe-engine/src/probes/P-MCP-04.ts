// SPDX-License-Identifier: BUSL-1.1
/**
 * P-MCP-04 — MCP authentication mode check.
 *
 * The 2026 MCP roadmap mandates OAuth-integrated auth. Static-secret servers
 * (API keys baked into clients) and `none` are findings; mTLS is acceptable
 * only when the auditee's threat model justifies it.
 *
 * Maps to: A.6.2.7 (security), A.10.3 (suppliers).
 */

import { z } from 'zod';

import { defineProbe } from '../dsl.js';
import { McpServerSnapshotSchema, type McpServerSnapshot } from './P-MCP-shared.js';
import { P_MCP_04_FIXTURES } from './P-MCP-04.fixtures.js';

export interface AuthModeResult {
  readonly mode: McpServerSnapshot['authMode'];
  readonly acceptable: boolean;
  readonly rationale: string;
  readonly valid: boolean;
}

export function runAuthModeProbe(
  snapshot: McpServerSnapshot,
  opts: { readonly allowMtls: boolean } = { allowMtls: true },
): AuthModeResult {
  const acceptableModes: readonly McpServerSnapshot['authMode'][] = opts.allowMtls
    ? ['oauth', 'mtls']
    : ['oauth'];
  const acceptable = acceptableModes.includes(snapshot.authMode);
  const rationale = acceptable
    ? `auth mode '${snapshot.authMode}' meets 2026 MCP roadmap`
    : `auth mode '${snapshot.authMode}' does not meet 2026 MCP roadmap (oauth required, mtls allowed by exception)`;
  return { mode: snapshot.authMode, acceptable, rationale, valid: acceptable };
}

const Params = z.object({
  snapshot: McpServerSnapshotSchema.optional(),
  // Default applied in run() so the parametersSchema's input/output types
  // stay aligned (avoids a ZodDefault input/output split that conflicts with
  // exactOptionalPropertyTypes in the probe DSL generic).
  allowMtls: z.boolean().optional(),
});

export const P_MCP_04 = defineProbe<z.infer<typeof Params>, AuthModeResult>({
  meta: {
    id: 'P-MCP-04',
    name: 'MCP authentication mode check',
    description: 'Verifies the MCP server uses OAuth (or mTLS by exception) per the 2026 MCP roadmap. Static secrets and none-auth are findings.',
    version: '0.1.0',
    category: 'composite',
    targetKinds: ['agentic'],
    controls: { clauses: [], annexA: ['A.6.2.7', 'A.10.3'], external: [] },
    executionModes: ['offline', 'replay'],
    budget: { estimatedCallsMin: 0, estimatedCallsMax: 0, costEstimateUsd: 0, wallClockMaxMs: 5_000, memoryMaxMb: 64, cpuMaxMs: 1_000 },
    references: [{ title: '2026 MCP roadmap — OAuth-integrated auth' }],
    groundTruthFixturePath: 'src/probes/P-MCP-04.fixtures.ts',
    deterministic: true,
    requiresInferenceClient: false,
    tags: ['mcp', 'auth', 'oauth'],
  },
  parametersSchema: Params,
  async run(_ctx, params) {
    const snapshot = (params.snapshot ?? P_MCP_04_FIXTURES.oauth) as McpServerSnapshot;
    const allowMtls = params.allowMtls ?? true;
    const r = runAuthModeProbe(snapshot, { allowMtls });
    return {
      verdict: r.valid ? 'pass' : 'fail',
      score: r.valid ? 1 : 0,
      derivedMetrics: { mode: r.mode, acceptable: r.acceptable, rationale: r.rationale },
      rawResponse: r,
      evidence: [{ kind: 'derived-metric', contentType: 'application/json', inline: r }],
    };
  },
});

export { P_MCP_04_FIXTURES };
