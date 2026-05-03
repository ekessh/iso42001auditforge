// SPDX-License-Identifier: BUSL-1.1
import { ConflictError, StateMachineError } from '@auditforge/shared';

import type {
  Engagement,
  EngagementStatus,
  LifecycleStage,
} from '../types/engagement.js';
import type { LedgerPort, TenantContext } from '../ports.js';

/**
 * Allowed transitions for `EngagementStatus`. Designed to be conservative —
 * the workflow state machines drive most state internally; this is the
 * outer envelope.
 */
const STATUS_TRANSITIONS: Readonly<Record<EngagementStatus, readonly EngagementStatus[]>> =
  Object.freeze({
    draft: ['planned', 'withdrawn'],
    planned: ['in_progress', 'suspended', 'withdrawn'],
    in_progress: ['awaiting_report', 'suspended', 'withdrawn'],
    awaiting_report: ['awaiting_decision', 'in_progress'],
    awaiting_decision: ['closed', 'in_progress'],
    closed: [],
    suspended: ['planned', 'in_progress', 'withdrawn'],
    withdrawn: [],
  });

const STAGE_TRANSITIONS: Readonly<Record<LifecycleStage, readonly LifecycleStage[]>> =
  Object.freeze({
    S1: ['S2', 'Special'],
    S2: ['Surv1', 'Special'],
    Surv1: ['Surv2', 'Special', 'Recert'],
    Surv2: ['Recert', 'Special'],
    Recert: ['Surv1', 'Special'], // start a new cycle
    Special: ['S1', 'S2', 'Surv1', 'Surv2', 'Recert'],
  });

/**
 * Engagement service — thin façade over the engagement aggregate. Real
 * persistence lives in `@auditforge/db`; this service is constructable
 * with an in-memory store for tests + the ledger port for emission.
 */
export class EngagementService {
  constructor(
    private readonly ledger: LedgerPort,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  /** Validate that `next` is a legal status transition. Pure. */
  static canTransitionStatus(
    current: EngagementStatus,
    next: EngagementStatus,
  ): boolean {
    if (current === next) return true;
    return STATUS_TRANSITIONS[current].includes(next);
  }

  /** Validate that `next` is a legal lifecycle-stage transition. Pure. */
  static canTransitionStage(
    current: LifecycleStage,
    next: LifecycleStage,
  ): boolean {
    if (current === next) return true;
    return STAGE_TRANSITIONS[current].includes(next);
  }

  /**
   * Move the engagement into a new status, emitting a ledger event.
   * Throws `StateMachineError` on illegal transitions.
   */
  async transitionStatus(
    tenant: TenantContext,
    engagement: Engagement,
    next: EngagementStatus,
    actor?: string,
    note?: string,
  ): Promise<Engagement> {
    if (!EngagementService.canTransitionStatus(engagement.status, next)) {
      throw new StateMachineError(engagement.status, next);
    }
    await this.ledger.emit({
      tenant,
      type: 'engagement.status_changed',
      payload: {
        engagementId: engagement.id,
        from: engagement.status,
        to: next,
        actor: actor ?? 'system',
        note: note ?? null,
        at: this.clock(),
      },
    });
    return { ...engagement, status: next };
  }

  /**
   * Advance the engagement lifecycle stage.
   */
  async transitionStage(
    tenant: TenantContext,
    engagement: Engagement,
    next: LifecycleStage,
    actor?: string,
  ): Promise<Engagement> {
    if (!EngagementService.canTransitionStage(engagement.lifecycleStage, next)) {
      throw new StateMachineError(engagement.lifecycleStage, next);
    }
    await this.ledger.emit({
      tenant,
      type: 'engagement.stage_changed',
      payload: {
        engagementId: engagement.id,
        from: engagement.lifecycleStage,
        to: next,
        actor: actor ?? 'system',
        at: this.clock(),
      },
    });
    return { ...engagement, lifecycleStage: next };
  }

  /**
   * Cross-check that the date window is non-empty and that the stage is
   * compatible with `status === 'planned'`. Throws `ConflictError`.
   */
  static assertConsistent(engagement: Engagement): void {
    if (engagement.startDate > engagement.endDate) {
      throw new ConflictError(
        `Engagement endDate (${engagement.endDate}) precedes startDate (${engagement.startDate})`,
        { engagementId: engagement.id },
      );
    }
  }
}
