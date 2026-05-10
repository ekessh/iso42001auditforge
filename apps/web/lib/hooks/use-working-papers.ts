// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { workingPapers, type WorkingPaper } from '@auditforge/api-client';

export interface UseWorkingPapersParams {
  engagementId?: string;
  cursor?: string;
  limit?: number;
}

export function useWorkingPapers(params: UseWorkingPapersParams = {}) {
  return useQuery({
    queryKey: ['working-papers', params],
    queryFn: ({ signal }) => workingPapers.listWorkingPapers(params, { signal }),
  });
}

export function useWorkingPaper(id: string) {
  return useQuery<WorkingPaper>({
    queryKey: ['working-paper', id],
    queryFn: ({ signal }) => workingPapers.getWorkingPaper(id, { signal }),
    enabled: Boolean(id),
  });
}
