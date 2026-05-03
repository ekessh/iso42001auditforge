// SPDX-License-Identifier: BUSL-1.1
import type { Brand, EngagementId, FirmId, WorkingPaperId } from '@auditforge/shared';

export type QuestionLibraryId = Brand<string, 'QuestionLibraryId'>;
export type QuestionInvocationId = Brand<string, 'QuestionInvocationId'>;
export type QuestionDecisionId = Brand<string, 'QuestionDecisionId'>;
export type ClauseId = Brand<string, 'ClauseId'>;
export type ControlId = Brand<string, 'ControlId'>;
export type ClaimId = Brand<string, 'ClaimId'>;
export type EpisodeId = Brand<string, 'EpisodeId'>;
export type ModelInvocationId = Brand<string, 'ModelInvocationId'>;
export type CoverageStateId = Brand<string, 'CoverageStateId'>;

export function asQuestionLibraryId(s: string): QuestionLibraryId {
  if (!s || s.length === 0) throw new TypeError('QuestionLibraryId: empty');
  return s as QuestionLibraryId;
}

export function asClauseId(s: string): ClauseId {
  if (!s || s.length === 0) throw new TypeError('ClauseId: empty');
  return s as ClauseId;
}

export function asClaimId(s: string): ClaimId {
  if (!s || s.length === 0) throw new TypeError('ClaimId: empty');
  return s as ClaimId;
}

export function asEpisodeId(s: string): EpisodeId {
  if (!s || s.length === 0) throw new TypeError('EpisodeId: empty');
  return s as EpisodeId;
}

export function asModelInvocationId(s: string): ModelInvocationId {
  if (!s || s.length === 0) throw new TypeError('ModelInvocationId: empty');
  return s as ModelInvocationId;
}

export type { EngagementId, FirmId, WorkingPaperId };
