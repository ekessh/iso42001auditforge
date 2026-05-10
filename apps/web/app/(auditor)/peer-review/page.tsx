// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useState } from 'react';
import { ClipboardList, MessageSquare, ShieldAlert } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import {
  useAddPeerReviewComment,
  usePeerReviewComments,
  usePeerReviewPackages,
  useResolvePeerReviewComment,
} from '@/lib/hooks/use-peer-review';

export default function PeerReviewPage() {
  const { data, isLoading, error } = usePeerReviewPackages({ limit: 50 });
  const items = data?.items ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Peer Review</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pre-issuance review packages assigned to you. Resolve every thread before approval.
          Findings flagged as security or data-protection trigger a +1 reviewer requirement.
        </p>
      </header>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error instanceof Error ? error.message : 'Failed to load review packages.'}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section aria-labelledby="pr-list">
          <h2 id="pr-list" className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Assigned packages
          </h2>
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<ClipboardList />}
              title="No packages assigned"
              description="Review packages will appear here when a lead auditor assigns you."
            />
          ) : (
            <ul className="space-y-2">
              {items.map((p) => {
                const isActive = activeId === p.id;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(p.id)}
                      aria-pressed={isActive}
                      className={[
                        'w-full text-left rounded-md border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive
                          ? 'border-primary bg-primary/5'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900',
                      ].join(' ')}
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Updated {new Date(p.updatedAt).toLocaleDateString()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-2" aria-labelledby="pr-thread">
          <h2 id="pr-thread" className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
            Comment threads
          </h2>
          {activeId ? (
            <CommentPane packageId={activeId} />
          ) : (
            <EmptyState
              icon={<MessageSquare />}
              title="Select a package"
              description="Click a package on the left to open its review thread."
            />
          )}
        </section>
      </div>
    </div>
  );
}

function CommentPane({ packageId }: { packageId: string }) {
  const { data, isLoading, error } = usePeerReviewComments(packageId);
  const add = useAddPeerReviewComment(packageId);
  const resolve = useResolvePeerReviewComment(packageId);
  const [body, setBody] = useState('');
  const [flag, setFlag] = useState<'standard' | 'security' | 'data-protection'>('standard');

  const items = data?.items ?? [];

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      {error && (
        <Alert tone="danger">
          {error instanceof Error ? error.message : 'Failed to load comments.'}
        </Alert>
      )}
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="rounded border border-slate-200 dark:border-slate-800 p-3">
              <div className="flex items-center gap-2">
                {c.flag !== 'standard' && (
                  <Badge tone="danger" className="gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    {c.flag}
                  </Badge>
                )}
                <span className="text-xs text-slate-500">
                  {new Date(c.createdAt).toLocaleString()}
                </span>
                {c.resolvedAt && <Badge tone="success">resolved</Badge>}
              </div>
              <p className="mt-2 text-sm">{c.body}</p>
              {!c.resolvedAt && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={() => resolve.mutate({ commentId: c.id, resolutionNote: 'Addressed.' })}
                  disabled={resolve.isPending}
                >
                  Resolve
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
        <label htmlFor="pr-comment" className="text-sm font-medium">
          New comment
        </label>
        <textarea
          id="pr-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Scope, observation, expected change…"
          className="mt-1 w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={3}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            aria-label="Flag"
            className="text-sm rounded border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
            value={flag}
            onChange={(e) => setFlag(e.target.value as typeof flag)}
          >
            <option value="standard">standard</option>
            <option value="security">security</option>
            <option value="data-protection">data-protection</option>
          </select>
          <Button
            size="sm"
            disabled={body.trim().length === 0 || add.isPending}
            onClick={() => {
              add.mutate(
                { parentId: null, scope: { kind: 'global' }, body, flag },
                { onSuccess: () => setBody('') },
              );
            }}
          >
            Add comment
          </Button>
        </div>
      </div>
    </div>
  );
}
