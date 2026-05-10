// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Activity, Upload } from 'lucide-react';
import { Alert, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useTraces } from '@/lib/hooks/use-traces';
import { UploadTraceModal } from '@/components/modals/UploadTraceModal';

export default function TracesPage() {
  const { data, isLoading, error } = useTraces({ limit: 200 });
  const items = data?.items ?? [];
  const [uploadOpen, setUploadOpen] = React.useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Traces</h1>
          <p className="text-sm text-slate-500 mt-1">
            Ingest agent traces (LangGraph, CrewAI, AutoGen, OTel, Langfuse, Phoenix) and analyze tool ACL drift, HITL gates, recursion limits.
          </p>
        </div>
        <Button size="sm" iconLeft={<Upload />} onClick={() => setUploadOpen(true)}>Upload trace</Button>
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load traces'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Activity />}
          title="No traces ingested"
          description="Upload a trace from your agent platform to begin analysis."
          action={<Button size="sm" iconLeft={<Upload />} onClick={() => setUploadOpen(true)}>Upload trace</Button>}
        />
      ) : (
        <table className="mt-6 w-full text-sm" aria-label="Traces">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="py-2 pr-3">
                  <Link
                    href={`/traces/${t.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t.name}
                  </Link>
                  <div className="text-xs text-slate-500 font-mono">{t.id}</div>
                </td>
                <td className="py-2 pr-3 tabular-nums text-slate-500">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-500">{new Date(t.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <UploadTraceModal open={uploadOpen} onOpenChange={setUploadOpen} />
    </div>
  );
}
