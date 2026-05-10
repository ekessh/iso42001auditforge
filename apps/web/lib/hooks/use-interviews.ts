// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { interviews } from '@auditforge/api-client';

export function useInterviewLibrary(params: interviews.ListLibraryParams = {}) {
  return useQuery({
    queryKey: ['interview-library', params],
    queryFn: ({ signal }) => interviews.listLibrary(params, { signal }),
  });
}

export function useComposeInterviewPlan() {
  return useMutation({
    mutationFn: (body: interviews.ComposePlanBody) => interviews.composePlan(body),
  });
}
