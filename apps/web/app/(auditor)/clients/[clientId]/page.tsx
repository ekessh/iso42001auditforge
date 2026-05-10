// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Pencil, Calendar } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useClient } from '@/lib/hooks/use-clients';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { ArchiveClientButton, EditClientModal } from '@/components/modals/ClientModals';

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { data, isLoading, error } = useClient(clientId);
  const engagementsQ = useEngagements({ limit: 200 });
  const [editing, setEditing] = React.useState(false);

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/clients" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Clients
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Client not found'}
        </Alert>
      </div>
    );
  }

  const linked = (engagementsQ.data?.items ?? []).filter((e) => e.clientId === clientId);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/clients" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Clients
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" iconLeft={<Pencil />} onClick={() => setEditing(true)}>Edit</Button>
          <ArchiveClientButton client={data} />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Client ID</dt>
          <dd className="font-mono text-xs mt-1">{data.id}</dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Firm</dt>
          <dd className="font-mono text-xs mt-1">{data.firmId}</dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Created</dt>
          <dd className="mt-1">{new Date(data.createdAt).toLocaleString()}</dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Updated</dt>
          <dd className="mt-1">{new Date(data.updatedAt).toLocaleString()}</dd>
        </div>
      </dl>

      <section className="mt-8" aria-labelledby="linked-engagements">
        <h2 id="linked-engagements" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">
          Engagements ({linked.length})
        </h2>
        {linked.length === 0 ? (
          <EmptyState
            icon={<Calendar />}
            title="No engagements for this client"
            description="Plan a new engagement to begin auditing this organisation."
          />
        ) : (
          <ul className="space-y-2">
            {linked.map((e) => (
              <li key={e.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/engagements/${e.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {e.id}
                    </Link>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{e.scopeStatement}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge tone={e.mode === 'audit' ? 'info' : 'warning'}>{e.mode}</Badge>
                    <Badge tone="neutral">{e.stage}</Badge>
                    <Badge tone={e.status === 'in_progress' ? 'success' : 'neutral'}>{e.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EditClientModal open={editing} onOpenChange={setEditing} client={data} />
    </div>
  );
}
