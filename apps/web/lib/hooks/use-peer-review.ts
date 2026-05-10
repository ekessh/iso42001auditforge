// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { peerReview } from '@auditforge/api-client';
import type { PeerReviewComment, PeerReviewPackage } from '@auditforge/api-client';

export function usePeerReviewPackages(params: { cursor?: string; limit?: number } = {}) {
  return useQuery({
    queryKey: ['peer-review-packages', params],
    queryFn: ({ signal }) => peerReview.listPackages(params, { signal }),
  });
}

export function usePeerReviewPackage(id: string) {
  return useQuery<PeerReviewPackage>({
    queryKey: ['peer-review-package', id],
    queryFn: ({ signal }) => peerReview.getPackage(id, { signal }),
    enabled: Boolean(id),
  });
}

export function usePeerReviewComments(packageId: string) {
  return useQuery({
    queryKey: ['peer-review-comments', packageId],
    queryFn: ({ signal }) => peerReview.listComments(packageId, { signal }),
    enabled: Boolean(packageId),
  });
}

export function useAddPeerReviewComment(packageId: string) {
  const qc = useQueryClient();
  return useMutation<PeerReviewComment, Error, peerReview.AddCommentBody>({
    mutationFn: (body) => peerReview.addComment(packageId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['peer-review-comments', packageId] });
    },
  });
}

export function useResolvePeerReviewComment(packageId: string) {
  const qc = useQueryClient();
  return useMutation<PeerReviewComment, Error, { commentId: string; resolutionNote: string }>({
    mutationFn: ({ commentId, resolutionNote }) =>
      peerReview.resolveComment(packageId, commentId, resolutionNote),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['peer-review-comments', packageId] });
    },
  });
}
