// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { use } from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import { Alert, Badge, Button, Skeleton } from '@auditforge/ui-kit';
import { useProbe } from '@/lib/hooks/use-probes';
import { RunProbeModal } from '@/components/modals/RunProbeModal';

export default function ProbeDetailPage({ params }: { params: Promise<{ probeId: string }> }) {
  const { probeId } = use(params);
  const { data, isLoading, error } = useProbe(probeId);
  const [runOpen, setRunOpen] = React.useState(false);

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
        <Link href="/probes" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Probes
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Probe not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/probes" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Probes
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <Badge tone="info">{data.mode}</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1 font-mono">{data.category}</p>
        </div>
        <Button size="sm" iconLeft={<Play />} onClick={() => setRunOpen(true)}>Run probe</Button>
      </div>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Budget USD" value={data.budgetUsd.toFixed(2)} />
        <Stat label="CPU ms" value={data.cpuMs.toLocaleString()} />
        <Stat label="Memory MB" value={data.memMb.toLocaleString()} />
      </dl>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Spec</h2>
        <pre className="overflow-x-auto text-xs leading-relaxed">{JSON.stringify(data.spec, null, 2)}</pre>
      </section>

      <RunProbeModal open={runOpen} onOpenChange={setRunOpen} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}
