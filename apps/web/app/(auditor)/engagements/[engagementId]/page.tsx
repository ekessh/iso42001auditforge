// SPDX-License-Identifier: BUSL-1.1
'use client';
import { use } from 'react';
import Link from 'next/link';
import { Alert, Skeleton } from '@auditforge/ui-kit';
import { useEngagement } from '@/lib/hooks/use-engagement';
import { useFindings } from '@/lib/hooks/use-findings';
import { useProbeExecutions } from '@/lib/hooks/use-probes';
import { useWorkingPapers } from '@/lib/hooks/use-working-papers';

const TABS = ['Overview', 'Plan', 'Working Papers', 'Findings', 'Probes', 'Traces', 'Report', 'Audit Trail'] as const;

export default function EngagementPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = use(params);
  const engagementQ = useEngagement(engagementId);
  const findingsQ = useFindings({ engagementId, limit: 200 });
  const probesQ = useProbeExecutions(engagementId);
  const wpQ = useWorkingPapers({ engagementId, limit: 200 });

  if (engagementQ.isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (engagementQ.error || !engagementQ.data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Link href="/engagements" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Engagements
        </Link>
        <Alert tone="danger" className="mt-4">
          {engagementQ.error instanceof Error ? engagementQ.error.message : 'Engagement not found'}
        </Alert>
      </div>
    );
  }

  const data = engagementQ.data;
  const findings = findingsQ.data?.items ?? [];
  const wps = wpQ.data?.items ?? [];
  const probes = probesQ.data?.items ?? [];

  const major = findings.filter((f) => f.severity === 'major_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const minor = findings.filter((f) => f.severity === 'minor_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const ofi = findings.filter((f) => f.severity === 'ofi' && f.status !== 'closed' && f.status !== 'verified').length;
  const wpComplete = wps.filter((w) => w.status === 'final').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/engagements" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Engagements
      </Link>
      <h1 className="text-2xl font-semibold mt-1">{data.clientId}</h1>
      <p className="text-sm text-slate-500 mt-1 max-w-3xl">{data.scopeStatement}</p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Stage" value={data.stage} />
        <Stat label="Status" value={data.status} />
        <Stat label="Mode" value={data.mode} />
        <Stat label="Ends" value={new Date(data.endsOn).toLocaleDateString()} />
      </div>

      <nav role="tablist" aria-label="Engagement tabs" className="mt-8 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-sm overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            role="tab"
            aria-selected={i === 0}
            className={`py-2 ${i === 0 ? 'border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card title="Open findings">
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between"><span>Major NC</span><span className="text-red-600 tabular-nums font-medium">{major}</span></li>
            <li className="flex justify-between"><span>Minor NC</span><span className="text-amber-600 tabular-nums font-medium">{minor}</span></li>
            <li className="flex justify-between"><span>OFI</span><span className="text-slate-500 tabular-nums font-medium">{ofi}</span></li>
          </ul>
        </Card>
        <Card title="Working papers">
          <div className="text-3xl font-semibold tabular-nums">{wpComplete} / {wps.length}</div>
          <div className="text-xs text-slate-500 mt-1">Complete / Total</div>
        </Card>
        <Card title="Probes & Traces">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-3xl font-semibold tabular-nums">{probes.length}</div>
              <div className="text-xs text-slate-500">Probe runs</div>
            </div>
            <div>
              <div className="text-3xl font-semibold tabular-nums">&mdash;</div>
              <div className="text-xs text-slate-500">Traces</div>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">{title}</div>
      {children}
    </div>
  );
}
