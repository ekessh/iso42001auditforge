// SPDX-License-Identifier: BUSL-1.1
'use client';

import Link from 'next/link';
import { Beaker } from 'lucide-react';
import { Alert, Badge, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useProbes } from '@/lib/hooks/use-probes';
import type { ProbeMode } from '@auditforge/api-client';

const MODE_TONE: Record<ProbeMode, 'success' | 'warning' | 'info'> = {
  offline: 'success',
  live: 'warning',
  replay: 'info',
};

export default function ProbesPage() {
  const { data, isLoading, error } = useProbes({ limit: 100 });
  const items = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Probes</h1>
      <p className="text-sm text-slate-500 mt-1">
        Run AI probes (bias, robustness, prompt injection, leakage, hallucination, drift, capability) in offline / live / replay mode.
      </p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load probes'}
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
          icon={<Beaker />}
          title="No probes registered"
          description="Probe definitions are managed by firm administrators."
        />
      ) : (
        <table className="mt-6 w-full text-sm" aria-label="Probes">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Category</th>
              <th className="py-2 pr-3">Mode</th>
              <th className="py-2 pr-3 tabular-nums">Budget USD</th>
              <th className="py-2 pr-3 tabular-nums">CPU ms</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="py-2 pr-3">
                  <Link
                    href={`/probes/${p.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {p.name}
                  </Link>
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{p.category}</td>
                <td className="py-2 pr-3"><Badge tone={MODE_TONE[p.mode]}>{p.mode}</Badge></td>
                <td className="py-2 pr-3 tabular-nums">{p.budgetUsd.toFixed(2)}</td>
                <td className="py-2 pr-3 tabular-nums">{p.cpuMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
