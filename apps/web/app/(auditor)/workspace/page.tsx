// SPDX-License-Identifier: BUSL-1.1
'use client';

import Link from 'next/link';
import { Activity } from 'lucide-react';
import { Alert, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useEngagements } from '@/lib/hooks/use-engagement';

export default function WorkspaceIndexPage() {
  const { data, isLoading, error } = useEngagements({ limit: 100 });
  const engagements = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Conversational Audit Workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick an engagement to open its live audit conversation.
      </p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load engagements'}
        </Alert>
      )}

      {isLoading ? (
        <ul className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </ul>
      ) : engagements.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Activity />}
          title="No active engagements"
          description="Open the Engagements console to plan a new engagement."
        />
      ) : (
        <ul className="mt-6 space-y-2">
          {engagements.map((e) => (
            <li key={e.id}>
              <Link
                href={`/workspace/${e.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{e.clientId}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.scopeStatement}</div>
                  </div>
                  <span className="rounded bg-muted px-2 py-0.5 text-2xs">{e.stage}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
