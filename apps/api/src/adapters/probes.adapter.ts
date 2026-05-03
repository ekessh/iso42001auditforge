// SPDX-License-Identifier: BUSL-1.1
//
// Probes adapter — wires `@auditforge/probe-engine` into the API.
//
// Provides:
//   - `ProbeRunner` (sandboxed probe execution with verdict + evidence)
//   - `BudgetController` (per-engagement spend ceiling)
//
// The adapter exposes the runner + budget controller; the BullMQ worker that
// processes the `probe-execution` queue uses these primitives. The HTTP
// service-layer keeps using the queue for async dispatch but the typed
// budget pre-flight now flows through the package's `BudgetController`
// instead of the previous SQL `sumCostByEngagement` heuristic.
//
// TODO(rls-migration): swap `InMemoryBudgetController` for the Redis-backed
// implementation that Fixer 5 is producing — once it lands, only the
// constructor needs to change.

import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InMemoryBudgetController,
  ProbeRunner,
  type BudgetController,
  type EngagementBudget,
  type LedgerSink,
  type ProbeLedgerEvent,
} from '@auditforge/probe-engine';
import { AuditEngineAdapter } from './audit-engine.adapter.js';

@Injectable()
export class ProbesAdapter {
  private readonly logger = new Logger(ProbesAdapter.name);

  readonly budget: BudgetController;
  readonly runner: ProbeRunner;

  constructor(@Inject(AuditEngineAdapter) private readonly audit: AuditEngineAdapter) {
    // TODO(rls-migration): replace with Redis-backed budget controller once
    // `packages/probe-engine` ships one (Fixer 5).
    this.budget = new InMemoryBudgetController();
    this.runner = new ProbeRunner({
      budget: this.budget,
      ledger: this.makeLedger(),
    });
  }

  /** Initialize a per-engagement budget if the caller hasn't already. */
  ensureBudget(engagementId: string, override?: Partial<EngagementBudget>): void {
    const defaults: EngagementBudget = {
      costCeilingUsd: 100,
      callCeiling: 10_000,
      warnThresholdUsd: 80,
    };
    this.budget.setEngagementBudget(engagementId, { ...defaults, ...override });
  }

  /**
   * Pre-flight a probe execution against the engagement budget. Throws
   * `ProbeBudgetExceeded` from `@auditforge/shared` on violation; callers in
   * the service layer translate that to HTTP 402.
   */
  preflight(args: {
    engagementId: string;
    probeId: string;
    mode: 'offline' | 'live' | 'replay';
    costEstimateUsd: number;
    estimatedCallsMin: number;
    estimatedCallsMax: number;
    wallClockMaxMs: number;
  }): void {
    this.ensureBudget(args.engagementId);
    this.budget.preflight(
      args.engagementId,
      args.probeId,
      {
        costEstimateUsd: args.costEstimateUsd,
        estimatedCallsMin: args.estimatedCallsMin,
        estimatedCallsMax: args.estimatedCallsMax,
        wallClockMaxMs: args.wallClockMaxMs,
      },
      args.mode,
    );
  }

  recordSpend(engagementId: string, costUsd: number, calls: number): void {
    this.ensureBudget(engagementId);
    this.budget.recordSpend(engagementId, costUsd, calls);
  }

  private makeLedger(): LedgerSink {
    return async (event: ProbeLedgerEvent) => {
      try {
        await this.audit.append({
          firmId: 'unknown', // probe events don't carry firmId; worker sets context
          engagementId: event.engagementId,
          actorId: 'system',
          type: event.type,
          entity: 'probe-execution',
          entityId: event.executionId,
          payload: { ...event },
        });
      } catch (err) {
        this.logger.error({ err }, 'probe ledger emit failed');
      }
    };
  }
}
