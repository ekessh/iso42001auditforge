// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import { DEFAULT_CHECKS, type ChecklistCheck } from '../checks/index.js';
import type { ReportPublicationContext } from '../domain/context.js';
import type { QaChecklistLedgerEvent } from '../domain/events.js';
import type { ChecklistItemResult, ChecklistResult } from '../domain/result.js';

export interface ChecklistLedgerEmitter {
  emit(event: QaChecklistLedgerEvent): void;
}

export interface Clock {
  now(): string;
}

const SYSTEM_CLOCK: Clock = { now: () => new Date().toISOString() };

export interface ChecklistRunnerOptions {
  /** Override the default check list. Empty array is rejected. */
  readonly checks?: readonly ChecklistCheck[];
  readonly ledger?: ChecklistLedgerEmitter;
  readonly clock?: Clock;
}

/**
 * ChecklistRunner is pure: it consumes a publication context snapshot, runs
 * every check, applies any auditor overrides found in `ctx.overrides`, and
 * returns a deterministic `{ passed, items }` result. When a `ledger` is
 * provided it ALSO emits a `qa_checklist.evaluated` event (and per-item
 * `qa_checklist.overridden` events for each applied override).
 */
export class ChecklistRunner {
  private readonly checks: readonly ChecklistCheck[];
  private readonly ledger: ChecklistLedgerEmitter | undefined;
  private readonly clock: Clock;

  constructor(opts: ChecklistRunnerOptions = {}) {
    const checks = opts.checks ?? DEFAULT_CHECKS;
    if (checks.length === 0) {
      throw new ValidationError('ChecklistRunner requires at least one check', {});
    }
    this.checks = checks;
    this.ledger = opts.ledger;
    this.clock = opts.clock ?? SYSTEM_CLOCK;
  }

  evaluate(args: {
    ctx: ReportPublicationContext;
    actorId: string;
  }): ChecklistResult {
    const items: ChecklistItemResult[] = [];
    const failedItemIds: string[] = [];
    const now = this.clock.now();

    for (const check of this.checks) {
      const raw = check.evaluate(args.ctx);
      const override = args.ctx.overrides[check.id];
      let item: ChecklistItemResult;

      if (raw.status === 'fail' && override) {
        if (override.rationale.trim().length === 0) {
          throw new ValidationError(
            `Override rationale for "${check.id}" is empty`,
            { itemId: check.id },
          );
        }
        item = {
          id: check.id,
          name: check.name,
          status: 'overridden',
          reason: raw.reason,
          overrideRationale: override.rationale,
        };
        if (this.ledger) {
          this.ledger.emit({
            kind: 'qa_checklist.overridden',
            firmId: args.ctx.firmId,
            engagementId: args.ctx.engagementId,
            reportId: args.ctx.draft.reportId,
            itemId: check.id,
            rationale: override.rationale,
            actorId: override.actorId,
            at: override.at,
          });
        }
      } else {
        item = {
          id: check.id,
          name: check.name,
          status: raw.status,
          reason: raw.reason,
        };
        if (raw.status === 'fail') failedItemIds.push(check.id);
      }
      items.push(item);
    }

    const passed = failedItemIds.length === 0;
    if (this.ledger) {
      this.ledger.emit({
        kind: 'qa_checklist.evaluated',
        firmId: args.ctx.firmId,
        engagementId: args.ctx.engagementId,
        reportId: args.ctx.draft.reportId,
        passed,
        failedItemIds,
        actorId: args.actorId,
        at: now,
      });
    }
    return { passed, items };
  }

  /** Convenience: assert passed; throws ValidationError otherwise. */
  assertPasses(args: {
    ctx: ReportPublicationContext;
    actorId: string;
  }): ChecklistResult {
    const r = this.evaluate(args);
    if (!r.passed) {
      throw new ValidationError('QA checklist did not pass', {
        failedItemIds: r.items.filter((i) => i.status === 'fail').map((i) => i.id),
      });
    }
    return r;
  }
}
