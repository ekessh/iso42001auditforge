// SPDX-License-Identifier: BUSL-1.1
import type { AiSystemKind, AiSystemProfile, AuditPhase, InterviewArea } from '../types/domain.js';

export interface ResolvedScope {
  readonly kinds: readonly AiSystemKind[];
  readonly phases: readonly AuditPhase[];
  readonly clauses: readonly string[];
  readonly tags: readonly string[];
}

export interface ScopeResolverInput {
  readonly profile: AiSystemProfile;
  readonly phase: AuditPhase;
  readonly area: InterviewArea;
}

/**
 * Deterministic scope resolution. Given an AI system profile + audit phase +
 * interview area, returns the relevant tag/clause/kind set used to query the
 * library. Stable ordering: tags and clauses are sorted ASCII-ascending so
 * downstream prioritisation is reproducible.
 */
export function resolveScope(input: ScopeResolverInput): ResolvedScope {
  const { profile, phase, area } = input;

  const kinds = unique([...profile.kinds]).sort();
  const phases = [phase];
  const clauses = unique([...profile.inScopeClauses, ...area.clauseTags]).sort();

  const tags = unique([
    ...area.clauseTags.map((c) => `clause:${c}`),
    ...profile.inScopeAnnexControls.map((c) => `annex:${c}`),
    ...kinds.map((k) => `kind:${k}`),
    `phase:${phase}`,
  ]).sort();

  return { kinds, phases, clauses, tags };
}

function unique<T>(arr: readonly T[]): T[] {
  return Array.from(new Set(arr));
}
