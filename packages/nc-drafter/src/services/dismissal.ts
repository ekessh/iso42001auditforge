// SPDX-License-Identifier: BUSL-1.1
/**
 * Dismissal helper. Validates a DismissalReason and returns a typed decision
 * row ready for insert into `candidate_finding_decisions`.
 *
 * The `'other'` code requires a non-empty free-text note — enforced both via
 * the zod superRefine on `DismissalReasonSchema` and again here so callers
 * that build the object manually still get a clear error.
 */
import {
  type CandidateFindingDecision,
  type DismissalReason,
  DismissalReasonSchema,
} from '../domain/candidate-finding.js';

export interface DismissInput {
  readonly candidateFindingId: string;
  readonly actor: string;
  readonly at: string;
  readonly reason: DismissalReason;
  readonly notes?: string;
  readonly idGen: () => string;
}

export function buildDismissalDecision(
  input: DismissInput,
): CandidateFindingDecision {
  const parsed = DismissalReasonSchema.safeParse(input.reason);
  if (!parsed.success) {
    throw new Error(
      `Invalid dismissal reason: ${parsed.error.issues.map((i) => i.message).join(';')}`,
    );
  }
  return {
    id: input.idGen(),
    candidateFindingId: input.candidateFindingId,
    action: 'dismiss',
    actor: input.actor,
    at: input.at,
    dismissalReason: parsed.data,
    promotedFindingId: null,
    notes: input.notes ?? null,
  } as CandidateFindingDecision;
}

export function buildPromotionDecision(args: {
  candidateFindingId: string;
  actor: string;
  at: string;
  promotedFindingId: string;
  idGen: () => string;
  notes?: string;
}): CandidateFindingDecision {
  return {
    id: args.idGen(),
    candidateFindingId: args.candidateFindingId,
    action: 'promote',
    actor: args.actor,
    at: args.at,
    dismissalReason: null,
    promotedFindingId: args.promotedFindingId,
    notes: args.notes ?? null,
  } as CandidateFindingDecision;
}

export function buildParkDecision(args: {
  candidateFindingId: string;
  actor: string;
  at: string;
  idGen: () => string;
  notes?: string;
}): CandidateFindingDecision {
  return {
    id: args.idGen(),
    candidateFindingId: args.candidateFindingId,
    action: 'park',
    actor: args.actor,
    at: args.at,
    dismissalReason: null,
    promotedFindingId: null,
    notes: args.notes ?? null,
  } as CandidateFindingDecision;
}
