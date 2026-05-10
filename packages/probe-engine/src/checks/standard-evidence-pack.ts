// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import {
  asAnyProbe,
  defineProbe,
  type AnyProbeDefinition,
  type ProbeRunResult,
} from '../dsl.js';
import {
  ExternalAuditEvidenceRunner,
  type ExternalBudget,
  type ExternalCheckOutcome,
  type ExternalRunStatus,
  type ExternalSandbox,
  type ExternalTarget,
} from '../external-runner.js';

export interface StandardEvidencePackEntry {
  readonly probeId: string;
  readonly sidecarCheckId: string;
  readonly title: string;
  readonly description: string;
  readonly annexA: readonly string[];
  readonly clauses: readonly string[];
  readonly externalRefs: readonly { framework: string; id: string }[];
}

export const STANDARD_EVIDENCE_PACK: readonly StandardEvidencePackEntry[] = [
  {
    probeId: 'P-AEAC-01',
    sidecarCheckId: 'AC-01',
    title: 'Authorization-Required',
    description:
      'Verifies the auditee endpoint refuses an unauthenticated request (HTTP 401/403).',
    annexA: ['A.7.4'],
    clauses: ['8.3'],
    externalRefs: [
      { framework: 'OWASP-LLM-Top10', id: 'LLM02' },
      { framework: 'NIST-AI-RMF', id: 'MEASURE-2.6' },
    ],
  },
  {
    probeId: 'P-AEAC-02',
    sidecarCheckId: 'AC-02',
    title: 'Rate-Limit-Present',
    description:
      'Drives configurable burst traffic and verifies the documented rate limiter trips inside the documented window.',
    annexA: ['A.6.2'],
    clauses: ['8.3'],
    externalRefs: [],
  },
  {
    probeId: 'P-AEAC-03',
    sidecarCheckId: 'AC-03',
    title: 'Input-Length-Bounded',
    description:
      'Submits an input one byte over the documented limit and verifies the endpoint rejects it.',
    annexA: ['A.6.2'],
    clauses: ['8.3'],
    externalRefs: [],
  },
  {
    probeId: 'P-AEAC-04',
    sidecarCheckId: 'AC-04',
    title: 'Output-Schema-Conformant',
    description:
      'Drives a known prompt and validates the response body against a documented JSON Schema.',
    annexA: ['A.6.2'],
    clauses: ['8.4'],
    externalRefs: [],
  },
  {
    probeId: 'P-AEAC-05',
    sidecarCheckId: 'AC-05',
    title: 'PII-Redaction-Active',
    description:
      'Sends a prompt with synthetic placeholder PII and verifies the documented redaction policy strips it from the response.',
    annexA: ['A.7.4', 'A.10.4'],
    clauses: ['7.5', '8.3'],
    externalRefs: [],
  },
  {
    probeId: 'P-AEAC-06',
    sidecarCheckId: 'AC-06',
    title: 'Provenance-Headers',
    description:
      'Verifies the response carries documented provenance headers (model version, system-prompt hash, etc.).',
    annexA: ['A.7.2'],
    clauses: ['7.5'],
    externalRefs: [],
  },
  {
    probeId: 'P-AEAC-07',
    sidecarCheckId: 'AC-07',
    title: 'Audit-Log-Generated',
    description:
      'Verifies the auditee audit log surfaces a ledger entry corresponding to a tagged call.',
    annexA: ['A.6.2', 'A.7.2'],
    clauses: ['7.5', '9.1'],
    externalRefs: [],
  },
];

export interface StandardEvidencePackOptions {
  readonly runner: ExternalAuditEvidenceRunner;
  readonly engagementContextJwt: string;
  readonly defaultTarget?: ExternalTarget;
  readonly defaultBudget?: ExternalBudget;
  readonly defaultSandbox?: ExternalSandbox;
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
}

const StandardEvidenceParamsSchema = z.object({
  target: z.unknown().optional(),
  params: z.record(z.unknown()).default({}),
  budget: z.unknown().optional(),
  sandbox: z.unknown().optional(),
});

export type StandardEvidenceParams = z.infer<typeof StandardEvidenceParamsSchema>;

const VERDICT_BY_STATUS: Record<ExternalCheckOutcome, ProbeRunResult['verdict']> = {
  pass: 'pass',
  fail: 'fail',
  error: 'inconclusive',
  terminated_by_budget: 'inconclusive',
};

export function buildStandardEvidencePack(
  options: StandardEvidencePackOptions,
): readonly AnyProbeDefinition[] {
  const pollIntervalMs = options.pollIntervalMs ?? 250;
  const pollTimeoutMs = options.pollTimeoutMs ?? 60_000;

  return STANDARD_EVIDENCE_PACK.map((entry) =>
    asAnyProbe(defineProbe({
      meta: {
        id: entry.probeId,
        name: entry.title,
        description: `${entry.description} Delegates execution to the audit-evidence-runner sidecar (sidecarCheckId=${entry.sidecarCheckId}).`,
        version: '0.1.0',
        category: 'composite',
        targetKinds: ['llm-generative', 'llm-rag', 'agentic', 'any'],
        controls: {
          clauses: [...entry.clauses],
          annexA: [...entry.annexA],
          external: [...entry.externalRefs],
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
        references: [],
        groundTruthFixturePath: `src/checks/standard-evidence-pack.ts#${entry.probeId}`,
        deterministic: false,
        requiresInferenceClient: false,
        tags: ['external-runner', 'audit-evidence', entry.sidecarCheckId.toLowerCase()],
      },
      parametersSchema: StandardEvidenceParamsSchema as unknown as z.ZodType<StandardEvidenceParams>,
      async run(_ctx, params) {
        const target = (params.target ?? options.defaultTarget) as ExternalTarget | undefined;
        if (!target) {
          throw new Error(
            `${entry.probeId}: no target supplied and no defaultTarget configured for the runner adapter`,
          );
        }
        const budget = (params.budget ?? options.defaultBudget) as ExternalBudget | undefined;
        if (!budget) {
          throw new Error(
            `${entry.probeId}: no budget supplied and no defaultBudget configured for the runner adapter`,
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
    })),
  );
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
