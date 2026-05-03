// SPDX-License-Identifier: BUSL-1.1
import { StateMachineError, ValidationError } from '@auditforge/shared';
import type { Verdict } from './domain.js';

/**
 * Allowed transitions between verdicts. Modelled as a DAG with explicit
 * tightening (toward more severe) and recovery (back to conformant or na).
 *
 * - conformant -> minor_nc, major_nc, ofi require a reason note ("downgrade").
 * - any -> na requires a reason note ("scope removal").
 * - minor_nc <-> major_nc transitions require a reason note (severity change).
 * - ofi -> conformant is permitted without a note (informational).
 * - All same-state transitions are no-ops and rejected (idempotency belongs at
 *   the registry level).
 */
const TRANSITIONS: Record<Verdict, ReadonlySet<Verdict>> = Object.freeze({
  conformant: new Set<Verdict>(['minor_nc', 'major_nc', 'ofi', 'na']),
  minor_nc: new Set<Verdict>(['conformant', 'major_nc', 'ofi', 'na']),
  major_nc: new Set<Verdict>(['conformant', 'minor_nc', 'ofi', 'na']),
  ofi: new Set<Verdict>(['conformant', 'minor_nc', 'major_nc', 'na']),
  na: new Set<Verdict>(['conformant', 'minor_nc', 'major_nc', 'ofi']),
});

/**
 * The transitions that REQUIRE a non-empty reason note. These are the
 * transitions an audit reviewer should be able to challenge — anything that
 * changes severity or removes the WP from scope.
 */
const REASON_REQUIRED: ReadonlySet<string> = new Set<string>([
  'conformant->minor_nc',
  'conformant->major_nc',
  'conformant->ofi',
  'conformant->na',
  'minor_nc->major_nc',
  'minor_nc->na',
  'major_nc->minor_nc',
  'major_nc->na',
  'ofi->minor_nc',
  'ofi->major_nc',
  'ofi->na',
  'na->minor_nc',
  'na->major_nc',
  'na->ofi',
]);

const ALL_VERDICTS: readonly Verdict[] = [
  'conformant',
  'minor_nc',
  'major_nc',
  'ofi',
  'na',
];

export function listAllowedTransitions(from: Verdict): readonly Verdict[] {
  const set = TRANSITIONS[from];
  return Object.freeze([...set].sort());
}

export function isTransitionAllowed(from: Verdict, to: Verdict): boolean {
  if (from === to) return false;
  return TRANSITIONS[from].has(to);
}

export function requiresReason(from: Verdict, to: Verdict): boolean {
  return REASON_REQUIRED.has(`${from}->${to}`);
}

export interface VerdictTransitionInput {
  from: Verdict;
  to: Verdict;
  reason?: string | undefined;
}

export interface VerdictTransitionResult {
  from: Verdict;
  to: Verdict;
  reason: string | undefined;
  reasonRequired: boolean;
}

/**
 * Validates and resolves a verdict transition. Throws `StateMachineError` if
 * disallowed; throws `ValidationError` if a reason note is required but absent.
 */
export function applyVerdictTransition(
  input: VerdictTransitionInput,
): VerdictTransitionResult {
  const { from, to } = input;
  const reason = input.reason?.trim();

  if (!isTransitionAllowed(from, to)) {
    throw new StateMachineError(from, to, {
      reason: 'verdict transition not permitted',
    });
  }

  const need = requiresReason(from, to);
  if (need && (!reason || reason.length === 0)) {
    throw new ValidationError(
      `Verdict transition ${from}->${to} requires a reason note`,
      { from, to },
    );
  }

  return {
    from,
    to,
    reason: reason && reason.length > 0 ? reason : undefined,
    reasonRequired: need,
  };
}

/** Internal export used by exhaustive tests to enumerate the universe. */
export const __ALL_VERDICTS = ALL_VERDICTS;
