// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

import {
  asAnyProbe,
  defineProbe,
  type AnyProbeDefinition,
  type ProbeRunResult,
} from '../dsl.js';
import type {
  ExternalAuditEvidenceRunner,
  ExternalBudget,
  ExternalCheckOutcome,
  ExternalRunStatus,
  ExternalSandbox,
  ExternalTarget,
} from '../external-runner.js';

export interface ConformanceEntry {
  readonly probeId: string;
  readonly sidecarCheckId: string;
  readonly title: string;
  readonly description: string;
  readonly annexA: readonly string[];
  readonly clauses: readonly string[];
  readonly externalRefs?: readonly { framework: string; id: string }[];
  readonly tags: readonly string[];
}

export interface ConformanceAdapterOptions {
  readonly runner: ExternalAuditEvidenceRunner;
  readonly engagementContextJwt: string;
  readonly defaultTarget?: ExternalTarget;
  readonly defaultBudget?: ExternalBudget;
  readonly defaultSandbox?: ExternalSandbox;
  readonly pollIntervalMs?: number;
  readonly pollTimeoutMs?: number;
}

export const ConformanceParamsSchema = z.object({
  target: z.unknown().optional(),
  params: z.record(z.unknown()).default({}),
  budget: z.unknown().optional(),
  sandbox: z.unknown().optional(),
});
export type ConformanceParams = z.infer<typeof ConformanceParamsSchema>;

const VERDICT_BY_STATUS: Record<ExternalCheckOutcome, ProbeRunResult['verdict']> = {
  pass: 'pass',
  fail: 'fail',
  error: 'inconclusive',
  terminated_by_budget: 'inconclusive',
};

export function defineConformanceProbe(
  entry: ConformanceEntry,
  options: ConformanceAdapterOptions,
  fixturePathPrefix: string,
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
      targetKinds: ['llm-generative', 'llm-rag', 'agentic', 'any'],
      controls: {
        clauses: [...entry.clauses],
        annexA: [...entry.annexA],
        external: [...(entry.externalRefs ?? [])],
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
      references: [{ title: 'AuditForge Conformance Pack' }],
      groundTruthFixturePath: `${fixturePathPrefix}#${entry.sidecarCheckId.toLowerCase()}`,
      deterministic: false,
      requiresInferenceClient: false,
      tags: ['external-runner', 'audit-evidence', entry.sidecarCheckId.toLowerCase(), ...entry.tags],
    },
    parametersSchema: ConformanceParamsSchema as unknown as z.ZodType<ConformanceParams>,
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
