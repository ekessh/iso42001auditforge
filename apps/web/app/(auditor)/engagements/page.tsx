// SPDX-License-Identifier: BUSL-1.1
'use client';
import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { Alert, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useEngagements } from '@/lib/hooks/use-engagement';

export default function EngagementsPage() {
  const { data, isLoading, error } = useEngagements({ limit: 100 });
  const engagements = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Engagements</h1>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load engagements'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : engagements.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Calendar />}
          title="No engagements yet"
          description="Create an engagement from the firm administration console to begin auditing."
        />
      ) : (
        <table className="mt-6 w-full text-sm" aria-label="Engagements">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Client</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Mode</th>
              <th className="py-2 pr-3">Starts</th>
              <th className="py-2 pr-3">Ends</th>
            </tr>
          </thead>
          <tbody>
            {engagements.map((e) => (
              <tr key={e.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="py-2 pr-3">
                  <Link
                    href={`/engagements/${e.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {e.clientId}
                  </Link>
                  <div className="text-xs text-slate-500 line-clamp-1">{e.scopeStatement}</div>
                </td>
                <td className="py-2 pr-3">{e.stage}</td>
                <td className="py-2 pr-3">{e.status}</td>
                <td className="py-2 pr-3 capitalize">{e.mode}</td>
                <td className="py-2 pr-3 tabular-nums">{e.startsOn}</td>
                <td className="py-2 pr-3 tabular-nums">{e.endsOn}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
