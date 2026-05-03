// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';

import { ValidationError } from '@auditforge/shared';

import type { AnyProbeDefinition, ProbeRunContext, ProbeRunResult } from './dsl.js';
import { isProbeRunResult } from './dsl.js';
import type { BudgetController } from './budget-controller.js';
import { sha256Json } from './hash.js';
import { mulberry32 } from './rng.js';
import {
  policyFromBudget,
  ProcessSandbox,
  type EgressTarget,
  type ProbeSandbox,
} from './sandbox.js';
import {
  EvidenceArtifactSchema,
  ProbeExecutionSchema,
  ProbeLedgerEventSchema,
  type EvidenceArtifact,
  type ProbeExecution,
  type ProbeExecutionMode,
  type ProbeLedgerEvent,
} from './types.js';
import { sha256 } from './hash.js';

/** External hook for emitting an audit-ledger event. */
export type LedgerSink = (event: ProbeLedgerEvent) => void | Promise<void>;

/** Optional log sink. */
export type Logger = (
  level: 'debug' | 'info' | 'warn' | 'error',
  msg: string,
  fields?: Record<string, unknown>,
) => void;

export interface ProbeRunnerDeps {
  readonly sandbox?: ProbeSandbox;
  readonly budget: BudgetController;
  readonly ledger: LedgerSink;
  readonly logger?: Logger;
}

export interface RunRequest<P> {
  readonly engagementId: string;
  readonly mode: ProbeExecutionMode;
  readonly params: P;
  readonly seed?: number;
  readonly approvedEgress?: readonly EgressTarget[];
  readonly inferenceClient?: import('./dsl.js').InferenceClient | null;
}

export class ProbeRunner {
  private readonly sandbox: ProbeSandbox;
  private readonly budget: BudgetController;
  private readonly ledger: LedgerSink;
  private readonly logger: Logger;

  constructor(deps: ProbeRunnerDeps) {
    this.sandbox = deps.sandbox ?? new ProcessSandbox();
    this.budget = deps.budget;
    this.ledger = deps.ledger;
    this.logger = deps.logger ?? (() => undefined);
  }

  /**
   * Run a probe end-to-end:
   *   1. Validate params via the probe's parametersSchema.
   *   2. Pre-flight the engagement budget.
   *   3. Build the sandbox policy and execute.
   *   4. Validate the run result schema.
   *   5. Emit the audit-ledger event.
   *   6. Record any spend back to the budget controller.
   */
  async run<P, R>(
    probe: AnyProbeDefinition,
    req: RunRequest<P>,
  ): Promise<ProbeExecution> {
    const startedAt = new Date().toISOString();
    const executionId = randomUUID();
    const seed = req.seed ?? 0;

    if (!probe.meta.executionModes.includes(req.mode)) {
      throw new ValidationError(
        `Probe ${probe.meta.id} does not support mode ${req.mode}`,
        { id: probe.meta.id, supported: probe.meta.executionModes, requested: req.mode },
      );
    }

    const parsed = probe.parametersSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new ValidationError('Probe params failed schema validation', {
        probeId: probe.meta.id,
        issues: parsed.error.issues,
      });
    }

    if (probe.meta.requiresInferenceClient && !req.inferenceClient && req.mode !== 'replay') {
      throw new ValidationError(
        `Probe ${probe.meta.id} requires an inferenceClient for mode ${req.mode}`,
        { probeId: probe.meta.id },
      );
    }

    this.budget.preflight(req.engagementId, probe.meta.id, probe.meta.budget, req.mode);

    const policy = policyFromBudget(
      probe.meta.budget,
      req.approvedEgress ?? [],
      req.mode === 'live' && Boolean(req.inferenceClient),
    );

    const ctx: ProbeRunContext = {
      engagementId: req.engagementId,
      executionId,
      mode: req.mode,
      random: mulberry32(seed),
      inferenceClient: req.inferenceClient ?? null,
      deadlineMs: Date.now() + policy.wallClockMaxMs,
      log: this.logger,
    };

    const sandboxResult = await this.sandbox.execute<P, R>({
      policy,
      probeId: probe.meta.id,
      probeVersion: probe.meta.version,
      params: parsed.data as P,
      ctx,
      runFn: probe.run as (
        c: ProbeRunContext,
        p: P,
      ) => Promise<ProbeRunResult<R>>,
    });

    const completedAt = new Date().toISOString();

    let verdict: ProbeExecution['verdict'];
    let score: number | undefined;
    let derivedMetrics: Record<string, number | string | boolean> = {};
    let rawResponse: unknown = undefined;
    let evidenceArtifacts: EvidenceArtifact[] = [];
    const errors: ProbeExecution['errors'] = [];
    let status: ProbeExecution['status'];

    if (sandboxResult.outcome === 'completed' && sandboxResult.result) {
      if (!isProbeRunResult(sandboxResult.result)) {
        verdict = 'error';
        status = 'failed';
        errors.push({
          code: 'PROBE_RESULT_INVALID',
          message: 'Probe returned a value that does not satisfy ProbeRunResult',
          retryable: false,
          details: {},
        });
      } else {
        verdict = sandboxResult.result.verdict;
        score = sandboxResult.result.score;
        derivedMetrics = { ...sandboxResult.result.derivedMetrics };
        rawResponse = sandboxResult.result.rawResponse;
        evidenceArtifacts = (sandboxResult.result.evidence ?? []).map((e) => {
          const inlineBytes = e.inline ? Buffer.byteLength(JSON.stringify(e.inline)) : 0;
          const inlineHash = e.inline ? sha256(JSON.stringify(e.inline)) : sha256('');
          return EvidenceArtifactSchema.parse({
            id: randomUUID(),
            kind: e.kind,
            contentType: e.contentType,
            bytes: inlineBytes,
            sha256: inlineHash,
            inline: e.inline,
          });
        });
        status = 'completed';
      }
    } else {
      verdict = 'error';
      status = 'failed';
      errors.push({
        code: `SANDBOX_${sandboxResult.outcome.toUpperCase()}`,
        message: sandboxResult.stderr || sandboxResult.outcome,
        retryable: sandboxResult.outcome === 'wallclock-timeout',
        details: {
          cpuMsUsed: sandboxResult.cpuMsUsed,
          wallMsUsed: sandboxResult.wallMsUsed,
          memoryMaxMbObserved: sandboxResult.memoryMaxMbObserved,
        },
      });
      for (const denial of sandboxResult.egressDenials) {
        errors.push({
          code: 'EGRESS_DENIED',
          message: `Egress to ${denial.target} denied: ${denial.reason}`,
          retryable: false,
          details: { ...denial },
        });
      }
    }

    const execution = ProbeExecutionSchema.parse({
      id: executionId,
      engagementId: req.engagementId,
      probeId: probe.meta.id,
      probeVersion: probe.meta.version,
      params: parsed.data as Record<string, unknown>,
      mode: req.mode,
      startedAt,
      completedAt,
      status,
      verdict,
      score,
      evidenceArtifacts,
      rawResponse,
      derivedMetrics,
      errors,
      seed,
      sandboxStub: this.sandbox instanceof ProcessSandbox,
    });

    // Record spend back to the budget controller for live mode.
    const inferenceCost =
      req.mode === 'live'
        ? Number(derivedMetrics['inferenceCostUsd'] ?? probe.meta.budget.costEstimateUsd)
        : 0;
    const inferenceCalls =
      req.mode === 'live'
        ? Number(derivedMetrics['inferenceCalls'] ?? probe.meta.budget.estimatedCallsMin)
        : 0;
    if (status === 'completed') {
      this.budget.recordSpend(req.engagementId, inferenceCost, inferenceCalls);
    }

    const ledgerEvent = ProbeLedgerEventSchema.parse({
      type: 'probe.executed',
      executionId,
      engagementId: req.engagementId,
      probeId: probe.meta.id,
      probeVersion: probe.meta.version,
      mode: req.mode,
      verdict,
      score,
      occurredAt: completedAt,
      paramsHash: sha256Json(parsed.data),
      resultHash: sha256Json({ verdict, score, derivedMetrics }),
      budgetSpentUsd: inferenceCost,
    });

    await this.ledger(ledgerEvent);

    return execution;
  }
}
