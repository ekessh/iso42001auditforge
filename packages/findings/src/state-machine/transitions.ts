// SPDX-License-Identifier: BUSL-1.1
/**
 * Finding state machine — hand-rolled tagged-union pattern (per the Phase 7
 * brief: "no booleans"). Every transition is enumerated. Allowed roles per
 * transition come from the `TRANSITIONS` table; `canTransition` and
 * `requireTransition` are the only public surface for runtime checks.
 *
 * Diagram:
 *
 *   draft   ── issue   ─▶  issued
 *   issued  ── accept  ─▶  accepted
 *   issued  ── dispute ─▶  disputed
 *   disputed ── accept  ─▶ accepted     (auditee accepts after disposition)
 *   disputed ── resolve ─▶ resolved     (auditor overrides dispute)
 *   accepted ── resolve ─▶ resolved
 *   resolved ── close   ─▶ closed
 *   resolved ── reopen  ─▶ accepted     (CAPA verification ineffective)
 *
 * `closed` is terminal except via the CAPA-driven `reopen` event from
 * `@auditforge/capa`'s `EffectivenessVerifier` which produces a NEW finding
 * carry-forward; the parent finding stays closed.
 */
import { StateMachineError } from '@auditforge/shared';
import type { FindingStatus } from '../types/finding.js';
import type { FindingRole } from '../types/roles.js';

export type TransitionAction =
  | 'issue'
  | 'accept'
  | 'dispute'
  | 'resolve'
  | 'close'
  | 'reopen';

export interface Transition {
  readonly action: TransitionAction;
  readonly from: FindingStatus;
  readonly to: FindingStatus;
  readonly allowedRoles: readonly FindingRole[];
}

/**
 * Authoritative transition table. Order matters only for readability.
 * Roles are deliberately tight: auditees can dispute, lead_auditor can
 * always close, reviewer can resolve but not close.
 */
export const TRANSITIONS: readonly Transition[] = [
  {
    action: 'issue',
    from: 'draft',
    to: 'issued',
    allowedRoles: ['lead_auditor', 'auditor'],
  },
  {
    action: 'accept',
    from: 'issued',
    to: 'accepted',
    allowedRoles: ['lead_auditor', 'auditor', 'auditee'],
  },
  {
    action: 'dispute',
    from: 'issued',
    to: 'disputed',
    allowedRoles: ['auditee'],
  },
  {
    action: 'accept',
    from: 'disputed',
    to: 'accepted',
    allowedRoles: ['auditee', 'lead_auditor'],
  },
  {
    action: 'resolve',
    from: 'disputed',
    to: 'resolved',
    allowedRoles: ['lead_auditor'],
  },
  {
    action: 'resolve',
    from: 'accepted',
    to: 'resolved',
    allowedRoles: ['lead_auditor', 'auditor', 'reviewer'],
  },
  {
    action: 'close',
    from: 'resolved',
    to: 'closed',
    allowedRoles: ['lead_auditor', 'auditor'],
  },
  {
    action: 'reopen',
    from: 'resolved',
    to: 'accepted',
    allowedRoles: ['lead_auditor', 'auditor'],
  },
];

/**
 * The finite set of statuses. Useful for exhaustiveness checks in tests.
 */
export const ALL_FINDING_STATUSES: readonly FindingStatus[] = [
  'draft',
  'issued',
  'accepted',
  'disputed',
  'resolved',
  'closed',
];

/**
 * Look up a transition by `(action, from)`. Returns `undefined` if no such
 * transition exists.
 */
export function lookupTransition(
  action: TransitionAction,
  from: FindingStatus,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.action === action && t.from === from);
}

export interface CanTransitionInput {
  readonly action: TransitionAction;
  readonly from: FindingStatus;
  readonly role: FindingRole;
}

export type CanTransitionResult =
  | { readonly ok: true; readonly to: FindingStatus }
  | { readonly ok: false; readonly reason: 'no_transition' | 'role_denied' };

export function canTransition(input: CanTransitionInput): CanTransitionResult {
  const t = lookupTransition(input.action, input.from);
  if (!t) return { ok: false, reason: 'no_transition' };
  if (!t.allowedRoles.includes(input.role)) {
    return { ok: false, reason: 'role_denied' };
  }
  return { ok: true, to: t.to };
}

/**
 * Enforce a transition or throw. Used by the registry.
 */
export function requireTransition(input: CanTransitionInput): FindingStatus {
  const r = canTransition(input);
  if (!r.ok) {
    throw new StateMachineError(input.from, input.action, {
      role: input.role,
      reason: r.reason,
    });
  }
  return r.to;
}
