// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useQuery } from '@tanstack/react-query';

import { library, type LibraryEntryKind } from '@auditforge/api-client';

export interface UseLibraryParams {
  cursor?: string;
  limit?: number;
  kind?: LibraryEntryKind;
  q?: string;
}

export function useLibrary(params: UseLibraryParams = {}) {
  return useQuery({
    queryKey: ['library', params],
    queryFn: ({ signal }) => library.listLibrary(params, { signal }),
  });
}
