// SPDX-License-Identifier: BUSL-1.1
'use client';

import { use } from 'react';
import Link from 'next/link';
import { Alert, Skeleton } from '@auditforge/ui-kit';
import { useTrace } from '@/lib/hooks/use-traces';

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const { data, isLoading, error } = useTrace(traceId);

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
        <Link href="/traces" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Traces
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Trace not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/traces" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Traces
      </Link>
      <h1 className="text-2xl font-semibold mt-1">{data.name}</h1>
      <p className="text-xs text-slate-500 mt-1 font-mono">{data.id}</p>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Metadata</h2>
        <pre className="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(data.metadata ?? {}, null, 2)}</pre>
      </section>
    </div>
  );
}
