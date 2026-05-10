// SPDX-License-Identifier: BUSL-1.1
'use client';

import { use } from 'react';
import Link from 'next/link';
import { Alert, Skeleton } from '@auditforge/ui-kit';
import { useClient } from '@/lib/hooks/use-clients';

export default function ClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = use(params);
  const { data, isLoading, error } = useClient(clientId);

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/clients" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Clients
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Client not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/clients" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Clients
      </Link>
      <h1 className="text-2xl font-semibold mt-1">{data.name}</h1>
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
    </div>
  );
}
