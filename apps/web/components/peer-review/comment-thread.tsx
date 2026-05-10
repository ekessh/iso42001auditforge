// SPDX-License-Identifier: BUSL-1.1
'use client';

import { ShieldAlert } from 'lucide-react';
import { Badge } from '@auditforge/ui-kit';
import type { PeerReviewComment } from '@auditforge/api-client';

export function CommentThread({ comments }: { comments: readonly PeerReviewComment[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-slate-500">No comments yet.</p>;
  }
  return (
    <ul className="space-y-3" aria-label="Peer review comments">
      {comments.map((c) => (
        <li key={c.id} className="rounded border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex items-center gap-2">
            {c.flag !== 'standard' && (
              <Badge tone="danger" className="gap-1">
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                {c.flag}
              </Badge>
            )}
            <span className="text-xs text-slate-500">
              {new Date(c.createdAt).toLocaleString()}
            </span>
            {c.resolvedAt && <Badge tone="success">resolved</Badge>}
          </div>
          <p className="mt-2 text-sm">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}
