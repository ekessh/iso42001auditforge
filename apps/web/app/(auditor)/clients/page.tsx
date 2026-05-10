// SPDX-License-Identifier: BUSL-1.1
'use client';

import Link from 'next/link';
import { Users } from 'lucide-react';
import { Alert, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useClients } from '@/lib/hooks/use-clients';

export default function ClientsPage() {
  const { data, isLoading, error } = useClients({ limit: 100 });
  const items = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Clients</h1>
      <p className="text-sm text-slate-500 mt-1">Auditee organizations under AIMS certification.</p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load clients'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<Users />}
          title="No clients loaded"
          description="Add a client organization to plan engagements against it."
        />
      ) : (
        <table className="mt-6 w-full text-sm" aria-label="Clients">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Created</th>
              <th className="py-2 pr-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="py-2 pr-3">
                  <Link
                    href={`/clients/${c.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 tabular-nums text-slate-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-3 tabular-nums text-slate-500">{new Date(c.updatedAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
