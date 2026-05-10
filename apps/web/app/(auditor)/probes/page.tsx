// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Beaker, Play } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useProbes } from '@/lib/hooks/use-probes';
import { RunProbeModal } from '@/components/modals/RunProbeModal';
import type { ProbeMode } from '@auditforge/api-client';

const MODE_TONE: Record<ProbeMode, 'success' | 'warning' | 'info'> = {
  offline: 'success',
  live: 'warning',
  replay: 'info',
};

export default function ProbesPage() {
  const { data, isLoading, error } = useProbes({ limit: 200 });
  const items = data?.items ?? [];
  const [runOpen, setRunOpen] = React.useState(false);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Probes</h1>
          <p className="text-sm text-slate-500 mt-1">
            Run AI probes (bias, robustness, prompt injection, leakage, hallucination, drift, capability) in offline / live / replay mode.
          </p>
        </div>
        <Button size="sm" iconLeft={<Play />} onClick={() => setRunOpen(true)}>Run probe</Button>
      </div>

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
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Probes catalogue">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3 tabular-nums">Budget USD</th>
                <th className="py-2 pr-3 tabular-nums">CPU ms</th>
                <th className="py-2 pr-3"></th>
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
                    <div className="text-xs text-slate-500 font-mono">{p.id}</div>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{p.category}</td>
                  <td className="py-2 pr-3"><Badge tone={MODE_TONE[p.mode]}>{p.mode}</Badge></td>
                  <td className="py-2 pr-3 tabular-nums">{p.budgetUsd.toFixed(2)}</td>
                  <td className="py-2 pr-3 tabular-nums">{p.cpuMs.toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <Button size="xs" variant="outline" iconLeft={<Play />} onClick={() => setRunOpen(true)}>
                      Run
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <RunProbeModal open={runOpen} onOpenChange={setRunOpen} />
    </div>
  );
}
