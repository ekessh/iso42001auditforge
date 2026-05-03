// SPDX-License-Identifier: BUSL-1.1
'use client';
import { useQuery } from '@tanstack/react-query';
import { mockEngagement } from '@/lib/mocks/engagements';

export function useEngagement(id: string) {
  return useQuery({
    queryKey: ['engagement', id],
    queryFn: async () => mockEngagement(id),
  });
}
