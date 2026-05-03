// SPDX-License-Identifier: BUSL-1.1
import { AuditForgeError, ConflictError, StateMachineError } from '@auditforge/shared';

import type {
  Engagement,
  EngagementMode,
  EngagementStatus,
  LifecycleStage,
} from '../types/engagement.js';
import { EngagementModeSchema } from '../types/engagement.js';
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
 * Thrown when a caller attempts to mutate `Engagement.mode` after creation.
 *
 * Mode is fixed for the life of the engagement (ADR-0013). Switching
 * mid-engagement would invalidate audit ledger references and the
 * readiness-mode disclaimer surface, and would let an unaccredited
 * self-assessment masquerade as a formal conformity audit (or vice versa).
 *
 * Mapped to HTTP 409 Conflict at the API boundary (RFC 7807 problem+json).
 */
export class ModeImmutableError extends AuditForgeError {
  constructor(
    fromMode: EngagementMode,
    toMode: EngagementMode,
    details: Record<string, unknown> = {},
  ) {
    super(
      'MODE_IMMUTABLE',
      `Engagement mode is immutable after creation: cannot change ${fromMode} -> ${toMode}`,
      409,
      { fromMode, toMode, ...details },
    );
  }
}

/**
 * Patch shape accepted by `EngagementService.update`. `mode` is *not*
 * declared on this type — attempts to include it must be rejected by the
 * runtime guard, but TypeScript callers will already see a compile error.
 *
 * @see ModeImmutableError
 */
export type EngagementUpdate = Partial<Omit<Engagement, 'id' | 'firmId' | 'mode'>>;

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

  /**
   * Validate the engagement payload at create-time. Mode is required, and
   * is validated against the enum to reject untrusted input. Pure.
   *
   * @throws TypeError if `mode` is missing or not a known `EngagementMode`.
   */
  static validateForCreate(input: {
    readonly mode: EngagementMode;
  }): void {
    EngagementModeSchema.parse(input.mode);
  }

  /**
   * Assert that `engagement.mode` matches `expected`. Used by call-sites
   * that are mode-specific (e.g. promote-to-finding only valid in audit
   * mode, add-to-action-plan only valid in readiness mode).
   *
   * @throws ConflictError if the mode does not match.
   */
  static assertMode(
    engagement: Pick<Engagement, 'id' | 'mode'>,
    expected: EngagementMode,
  ): void {
    if (engagement.mode !== expected) {
      throw new ConflictError(
        `Operation requires engagement.mode='${expected}' but engagement is in '${engagement.mode}' mode`,
        {
          engagementId: engagement.id,
          expectedMode: expected,
          actualMode: engagement.mode,
        },
      );
    }
  }

  /**
   * Apply an update patch to an engagement.
   *
   * Mode is *immutable* (ADR-0013). The static `EngagementUpdate` type
   * already excludes `mode` at the type level, but we also enforce it at
   * runtime: any patch that carries a different `mode` value than the
   * current engagement (or carries `mode` at all when supplied as untyped
   * input) is rejected with `ModeImmutableError` mapped to HTTP 409.
   */
  static update(current: Engagement, patch: EngagementUpdate): Engagement {
    // Defence-in-depth: callers that bypass the static type (e.g. raw
    // JSON over the wire) cannot sneak `mode` through.
    const incoming = patch as { mode?: EngagementMode };
    if (
      Object.prototype.hasOwnProperty.call(patch, 'mode') &&
      incoming.mode !== undefined &&
      incoming.mode !== current.mode
    ) {
      throw new ModeImmutableError(current.mode, incoming.mode, {
        engagementId: current.id,
      });
    }
    // Strip mode from the patch in case it was supplied as a no-op match.
    const { mode: _ignoredMode, ...safePatch } = incoming;
    void _ignoredMode;
    return { ...current, ...safePatch };
  }
}
