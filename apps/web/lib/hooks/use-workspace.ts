// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * useWorkspace — composed query for the Conversational Audit Workspace.
 *
 * Composes engagement, coverage, and candidate-findings via api-client.
 * Messages and claims still come from the workspace-mock fixture because
 * the Conversational Engine endpoints (/conversation, /claims) are still
 * pending Agent A wiring (Phase 7.6).
 *
 * TODO(agent-a / phase 7.6): swap mock messages + claims for
 *   GET /engagements/:id/conversation
 *   GET /engagements/:id/claims
 */

import { useQuery } from '@tanstack/react-query';

import {
  candidateFindings as candidateFindingsApi,
  coverage as coverageApi,
  engagements as engagementsApi,
  type CandidateFinding as ApiCandidateFinding,
  type CoverageArea as ApiCoverageArea,
  type Engagement,
} from '@auditforge/api-client';

import {
  buildWorkspaceMock,
  type CandidateFinding,
  type ClaimEntry,
  type ConversationMessage,
  type CoverageArea,
  type EngagementMode,
  type WorkspaceContext,
  type WorkspaceMock,
} from '@/lib/mocks/workspace-mock';

function mapEngagementToContext(
  e: Engagement,
  fallback: WorkspaceContext,
  mode: EngagementMode,
): WorkspaceContext {
  return {
    ...fallback,
    engagementId: e.id,
    mode,
    clientName: fallback.clientName,
    scope: e.scopeStatement || fallback.scope,
  };
}

function asCandidateFinding(c: ApiCandidateFinding): CandidateFinding {
  return c as CandidateFinding;
}

function asCoverageArea(c: ApiCoverageArea): CoverageArea {
  return c as CoverageArea;
}

export function useWorkspace(
  engagementId: string,
  mode: EngagementMode = 'audit',
) {
  return useQuery<WorkspaceMock>({
    queryKey: ['workspace', engagementId, mode],
    queryFn: async ({ signal }) => {
      const fallback = buildWorkspaceMock(engagementId, mode);
      const settled = await Promise.allSettled([
        engagementsApi.getEngagement(engagementId, { signal }),
        coverageApi.getCoverage(engagementId, { signal }),
        candidateFindingsApi.listCandidateFindings(engagementId, { signal }),
      ]);

      const [engRes, covRes, cfRes] = settled;

      const context: WorkspaceContext =
        engRes.status === 'fulfilled'
          ? mapEngagementToContext(engRes.value, fallback.context, mode)
          : fallback.context;

      const coverageArea: CoverageArea =
        covRes.status === 'fulfilled'
          ? asCoverageArea(covRes.value)
          : fallback.coverageArea;

      const candidates: CandidateFinding[] =
        cfRes.status === 'fulfilled'
          ? cfRes.value.map(asCandidateFinding)
          : fallback.candidateFindings;

      const messages: ConversationMessage[] = fallback.messages;
      const claims: ClaimEntry[] = fallback.claims;

      return {
        context,
        coverageArea,
        candidateFindings: candidates,
        messages,
        claims,
      };
    },
    enabled: Boolean(engagementId),
    staleTime: 60_000,
  });
}
