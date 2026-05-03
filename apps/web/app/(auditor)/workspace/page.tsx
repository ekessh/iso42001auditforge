// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * /workspace — engagement picker that redirects auditors to the
 * Conversational Audit Workspace for a specific engagement. v3 §15.11.
 */

import Link from 'next/link';

import { listEngagements } from '@/lib/mocks/engagements';

export default function WorkspaceIndexPage() {
  const engagements = listEngagements();
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Conversational Audit Workspace</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick an engagement to open its live audit conversation.
      </p>
      <ul className="mt-6 space-y-2">
        {engagements.map((e) => (
          <li key={e.id}>
            <Link
              href={`/workspace/${e.id}`}
              className="block rounded-lg border border-border bg-card p-4 hover:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{e.clientName}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.scope}</div>
                </div>
                <span className="rounded bg-muted px-2 py-0.5 text-2xs">{e.lifecycleStage}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
