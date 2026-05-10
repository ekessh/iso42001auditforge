// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import {
  asAnyProbe,
  defineProbe,
  type AnyProbeDefinition,
  type ProbeRunResult,
} from '../../dsl.js';
import type {
  ExternalAuditEvidenceRunner,
  ExternalBudget,
  ExternalCheckOutcome,
  ExternalRunStatus,
  ExternalSandbox,
  ExternalTarget,
} from '../../external-runner.js';

export interface McpConformanceEntry {
  readonly probeId: string;
  readonly sidecarCheckId: string;
  readonly title: string;
  readonly description: string;
  readonly annexA: readonly string[];
  readonly clauses: readonly string[];
}

export interface McpConformanceAdapterOptions {
  readonly runner: ExternalAuditEvidenceRunner;
  readonly engagementContextJwt: string;
  readonly defaultTarget?: ExternalTarget;
  readonly defaultBudget?: ExternalBudget;
  readonly defaultSandbox?: ExternalSandbox;
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
}

export const McpConformanceParamsSchema = z.object({
  target: z.unknown().optional(),
  params: z.record(z.unknown()).default({}),
  budget: z.unknown().optional(),
  sandbox: z.unknown().optional(),
});
export type McpConformanceParams = z.infer<typeof McpConformanceParamsSchema>;

const VERDICT_BY_STATUS: Record<ExternalCheckOutcome, ProbeRunResult['verdict']> = {
  pass: 'pass',
  fail: 'fail',
  error: 'inconclusive',
  terminated_by_budget: 'inconclusive',
};

export function defineMcpConformanceProbe(
  entry: McpConformanceEntry,
  options: McpConformanceAdapterOptions,
): AnyProbeDefinition {
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const pollTimeoutMs = options.pollTimeoutMs ?? 60_000;

  return asAnyProbe(defineProbe({
    meta: {
      id: entry.probeId,
      name: entry.title,
      description: `${entry.description} Delegates execution to the audit-evidence-runner sidecar (sidecarCheckId=${entry.sidecarCheckId}).`,
      version: '0.1.0',
      category: 'composite',
      targetKinds: ['agentic', 'llm-rag', 'any'],
      controls: {
        clauses: [...entry.clauses],
        annexA: [...entry.annexA],
        external: [{ framework: 'MCP-Spec', id: entry.sidecarCheckId }],
      },
      executionModes: ['live'],
      budget: {
        estimatedCallsMin: 1,
        estimatedCallsMax: 64,
        costEstimateUsd: 0.05,
        wallClockMaxMs: 60_000,
        memoryMaxMb: 256,
        cpuMaxMs: 30_000,
      },
      references: [{ title: 'AuditForge MCP Conformance Pack' }],
      groundTruthFixturePath: `src/checks/mcp-conformance/${entry.sidecarCheckId.toLowerCase()}.ts`,
      deterministic: false,
      requiresInferenceClient: false,
      tags: ['mcp', 'conformance', 'external-runner', entry.sidecarCheckId.toLowerCase()],
    },
    parametersSchema: McpConformanceParamsSchema as unknown as z.ZodType<McpConformanceParams>,
    async run(_ctx, params) {
      const target = (params.target ?? options.defaultTarget) as ExternalTarget | undefined;
      if (!target) {
        throw new Error(
          `${entry.probeId}: no target supplied and no defaultTarget configured`,
        );
      }
      const budget = (params.budget ?? options.defaultBudget) as ExternalBudget | undefined;
      if (!budget) {
        throw new Error(
          `${entry.probeId}: no budget supplied and no defaultBudget configured`,
        );
      }
      const sandbox = (params.sandbox ?? options.defaultSandbox) as ExternalSandbox | undefined;

      const startArgs: Parameters<typeof options.runner.start>[0] = {
        checkId: entry.sidecarCheckId,
        target,
        params: params.params ?? {},
        budget,
        engagementContextJwt: options.engagementContextJwt,
      };
      if (sandbox !== undefined) {
        (startArgs as { sandbox?: ExternalSandbox }).sandbox = sandbox;
      }
      const runId = await options.runner.start(startArgs);

      const status = await pollUntilDone(options.runner, runId, pollIntervalMs, pollTimeoutMs);
      const result = status.result;
      if (!result) {
        return {
          verdict: 'inconclusive',
          score: 0,
          derivedMetrics: {
            checkId: entry.sidecarCheckId,
            externalState: status.state,
          },
          evidence: [],
        };
      }
      return {
        verdict: VERDICT_BY_STATUS[result.status],
        score: result.status === 'pass' ? 1 : 0,
        derivedMetrics: {
          checkId: entry.sidecarCheckId,
          externalSeverity: result.severity,
          externalCalls: result.metrics.calls,
          externalTokens: result.metrics.tokens,
          externalUsd: result.metrics.usd,
          externalWallSeconds: result.metrics.wall_seconds,
          terminatedByBudget: result.terminated_by_budget,
        },
        rawResponse: result,
        evidence: [
          { kind: 'derived-metric', contentType: 'application/json', inline: result },
        ],
      };
    },
  }));
}

async function pollUntilDone(
  runner: ExternalAuditEvidenceRunner,
  runId: string,
  intervalMs: number,
  timeoutMs: number,
): Promise<ExternalRunStatus> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await runner.status(runId);
    if (status.state === 'complete' || status.state === 'error' || status.state === 'cancelled') {
      return status;
    }
    await sleep(intervalMs);
  }
  throw new Error(`audit-evidence-runner run ${runId} did not finish within ${timeoutMs}ms`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

export const MCP_CONFORMANCE_CATALOGUE: readonly McpConformanceEntry[] = [
  {
    probeId: 'P-AEMCP-01',
    sidecarCheckId: 'P-MCP-01',
    title: 'MCP Tool-Catalogue-Validation',
    description:
      'Verifies served MCP tool descriptions match the auditee\'s documented capability inventory.',
    annexA: ['A.6.2.7', 'A.10.3'],
    clauses: ['8.3'],
  },
  {
    probeId: 'P-AEMCP-02',
    sidecarCheckId: 'P-MCP-02',
    title: 'MCP Server-Allowlist',
    description:
      'Verifies the MCP host enforces an allowlist of upstream MCP servers; off-list registrations are denied.',
    annexA: ['A.10.3'],
    clauses: ['8.3'],
  },
  {
    probeId: 'P-AEMCP-03',
    sidecarCheckId: 'P-MCP-03',
    title: 'MCP Audit-Trail-Completeness',
    description:
      'Verifies tool invocations surface as ledger entries on the auditee audit endpoint.',
    annexA: ['A.6.2'],
    clauses: ['7.5', '9.1'],
  },
  {
    probeId: 'P-AEMCP-04',
    sidecarCheckId: 'P-MCP-04',
    title: 'MCP Authentication-Mode',
    description:
      'Verifies the MCP server enforces authentication and rejects anonymous requests.',
    annexA: ['A.7.4'],
    clauses: ['8.3'],
  },
  {
    probeId: 'P-AEMCP-05',
    sidecarCheckId: 'P-MCP-05',
    title: 'MCP Per-Tool-RBAC',
    description:
      'Exercises each tool with authorized + unauthorized identities to verify the documented role-based policy.',
    annexA: ['A.7.4'],
    clauses: ['8.3'],
  },
  {
    probeId: 'P-AEMCP-06',
    sidecarCheckId: 'P-MCP-06',
    title: 'MCP Resource-Provenance-Verification',
    description:
      'Verifies served MCP resources carry the documented provenance metadata.',
    annexA: ['A.7.2', 'A.10.3'],
    clauses: ['7.5', '8.3'],
  },
  {
    probeId: 'P-AEMCP-07',
    sidecarCheckId: 'P-MCP-07',
    title: 'MCP Cross-Server-Session-Isolation',
    description:
      'Verifies session state from one MCP connection does not leak into another.',
    annexA: ['A.7.4'],
    clauses: ['8.3'],
  },
  {
    probeId: 'P-AEMCP-08',
    sidecarCheckId: 'P-MCP-08',
    title: 'MCP Gateway-Policy-Enforcement',
    description:
      'Verifies documented gateway policies (rate limit, content filter) trip before the upstream model is reached.',
    annexA: ['A.6.2'],
    clauses: ['8.3'],
  },
];
