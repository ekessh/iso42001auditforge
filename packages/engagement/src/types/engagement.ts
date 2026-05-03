// SPDX-License-Identifier: BUSL-1.1
import type {
  AuditorId,
  ClientId,
  EngagementId,
  FirmId,
} from '@auditforge/shared';

/**
 * Engagement mode (ADR-0013).
 *
 * `audit`     — formal third-party / second-party conformity audit driven
 *               by an accredited certification programme. Findings are
 *               candidate Findings/NCs that may be promoted into a formal
 *               nonconformity.
 * `readiness` — self-assessment using ISO/IEC 42001 as a reference
 *               framework. Findings are Improvement Items added to an
 *               action plan. The output is NOT a certificate and the
 *               disclaimer in the workspace must make this explicit.
 *
 * Mode is decided at engagement creation and is *immutable* for the life
 * of the engagement. Switching mid-engagement would violate evidence
 * provenance (audit ledger references) and the readiness disclaimer
 * surface.
 *
 * Reference: docs/adr/0013-mode-separation.md (audit vs readiness).
 */
export const ENGAGEMENT_MODES = ['audit', 'readiness'] as const;
export type EngagementMode = (typeof ENGAGEMENT_MODES)[number];

/**
 * Lightweight runtime guard for `EngagementMode`. Mirrors the surface of
 * a `z.enum(['audit', 'readiness'])` schema (`safeParse`/`parse`) so that
 * callers can validate untrusted input (e.g. API DTOs) without pulling
 * Zod into this package's runtime closure.
 */
export const EngagementModeSchema = Object.freeze({
  values: ENGAGEMENT_MODES,
  /** Type guard form. */
  is(value: unknown): value is EngagementMode {
    return (
      typeof value === 'string' &&
      (ENGAGEMENT_MODES as readonly string[]).includes(value)
    );
  },
  /** Returns the value if valid, otherwise throws `TypeError`. */
  parse(value: unknown): EngagementMode {
    if (!EngagementModeSchema.is(value)) {
      throw new TypeError(
        `EngagementMode must be one of [${ENGAGEMENT_MODES.join(', ')}], received: ${String(value)}`,
      );
    }
    return value;
  },
  /** Zod-style discriminated result. */
  safeParse(
    value: unknown,
  ): { success: true; data: EngagementMode } | { success: false; error: TypeError } {
    if (EngagementModeSchema.is(value)) {
      return { success: true, data: value };
    }
    return {
      success: false,
      error: new TypeError(
        `EngagementMode must be one of [${ENGAGEMENT_MODES.join(', ')}], received: ${String(value)}`,
      ),
    };
  },
} as const);

/**
 * The lifecycle stage of an engagement (one per certification cycle).
 *
 * S1   — Stage 1 (documentation review, readiness assessment)
 * S2   — Stage 2 (full conformity audit, certificate issuance)
 * Surv1 — First surveillance (typically 12 months after certification)
 * Surv2 — Second surveillance (typically 24 months after certification)
 * Recert — Recertification (typically 36 months after certification)
 * Special — Out-of-cycle audit (scope extension, transfer, short-notice, witnessed)
 *
 * Reference: ISO/IEC 17021-1:2015, clause 9.6 (3-year cycle).
 */
export type LifecycleStage =
  | 'S1'
  | 'S2'
  | 'Surv1'
  | 'Surv2'
  | 'Recert'
  | 'Special';

/**
 * Coarse-grained engagement status. State machine transitions (e.g. between
 * `planned -> in_progress -> awaiting_report -> closed`) are handled by the
 * specific stage workflows; this is just for high-level filtering.
 */
export type EngagementStatus =
  | 'draft'
  | 'planned'
  | 'in_progress'
  | 'awaiting_report'
  | 'awaiting_decision'
  | 'closed'
  | 'suspended'
  | 'withdrawn';

/**
 * Scope of the AIMS being audited.
 *
 * `aimsScopeStatement` is the customer-supplied scope text (free form, but
 * captured verbatim for the certificate). The structured fields below are
 * what the programme calculator consumes.
 */
export interface AimsScope {
  readonly aimsScopeStatement: string;
  readonly useCaseCount: number;
  readonly modelCount: number;
  readonly agentCount: number;
  readonly siteCount: number;
  readonly complexity: 'low' | 'medium' | 'high';
  /**
   * Other management systems integrated with the AIMS. Used by the programme
   * calculator to apply IAF MD 11 / MD 23 integration reductions.
   *
   * Example: `['ISO/IEC 27001', 'ISO 9001']`
   */
  readonly integratedManagementSystems: readonly string[];
  /**
   * Percentage of the audit conducted as virtual / remote (0-100). Per
   * IAF MD 4 there are upper bounds on virtual audit percentage; the
   * calculator does not reject high values, only flags them in the rationale.
   */
  readonly virtualAuditPercentage: number;
  /**
   * Percentage reduction (0-100) for non-applicable controls / similar
   * activities at sites, per IAF MD 1 multi-site sampling. Optional.
   */
  readonly multiSiteSamplingReductionPct?: number;
}

/**
 * One certification cycle for one client. The engagement is the root
 * aggregate for everything the audit team will do for this client during
 * the cycle (typically 3 years).
 *
 * Tenancy: every operation on an engagement must carry the `(firmId,
 * clientId, engagementId)` triple — see `@auditforge/tenancy-core` for the
 * RLS guard. The engagement itself owns the `firmId`/`clientId` so the
 * service layer can short-circuit cross-tenant access.
 */
export interface Engagement {
  readonly id: EngagementId;
  readonly firmId: FirmId;
  readonly clientId: ClientId;
  /**
   * Engagement mode (ADR-0013). Decided at creation. **Immutable.** Any
   * mutation that would change `mode` after creation must be rejected by
   * the service layer with `ModeImmutableError`.
   */
  readonly mode: EngagementMode;
  readonly scope: AimsScope;
  /**
   * The current stage in the certification cycle. The full sequence is
   * usually `S1 -> S2 -> Surv1 -> Surv2 -> Recert`. `Special` is used for
   * out-of-cycle audits.
   */
  readonly lifecycleStage: LifecycleStage;
  readonly startDate: string; // ISO 8601 date (YYYY-MM-DD)
  readonly endDate: string; // ISO 8601 date (YYYY-MM-DD)
  readonly status: EngagementStatus;
  /**
   * Auditor responsible for the overall engagement. Typically the lead
   * auditor of Stage 2; surveillance/recert may rotate but the engagement
   * "owner" stays consistent for accountability.
   */
  readonly leadAuditorId: AuditorId;
  /**
   * Optional cap on the next certification decision date. When this is set
   * surveillance/recert workflows must complete before this date or
   * the certificate lapses (ISO/IEC 17021-1:2015 clause 9.6.3).
   */
  readonly certificateExpiryDate?: string;
}
