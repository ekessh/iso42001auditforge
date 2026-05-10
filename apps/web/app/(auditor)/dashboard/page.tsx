// SPDX-License-Identifier: BUSL-1.1
'use client';
import Link from 'next/link';
import { Calendar, AlertTriangle, FileCheck, Beaker } from 'lucide-react';
import { EmptyState, Skeleton, Alert } from '@auditforge/ui-kit';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useFindings } from '@/lib/hooks/use-findings';
import { useProbes } from '@/lib/hooks/use-probes';
import { usePalette } from '@/lib/cmdk/palette-store';

export default function DashboardPage() {
  const engagementsQuery = useEngagements({ limit: 50 });
  const findingsQuery = useFindings({ limit: 200 });
  const probesQuery = useProbes({ limit: 200 });
  const trigger = usePalette((s) => s.trigger);

  const engagements = engagementsQuery.data?.items ?? [];
  const findings = findingsQuery.data?.items ?? [];
  const probes = probesQuery.data?.items ?? [];

  const totalOpenMajor = findings.filter((f) => f.severity === 'major_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const totalOpenMinor = findings.filter((f) => f.severity === 'minor_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const probesRun = probes.length;

  const isLoading = engagementsQuery.isLoading || findingsQuery.isLoading || probesQuery.isLoading;
  const error = engagementsQuery.error ?? findingsQuery.error ?? probesQuery.error;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-slate-500 mt-1">
        {isLoading ? 'Loading…' : `${engagements.length} active engagements`}
      </p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load dashboard data'}
        </Alert>
      )}

      <section aria-labelledby="kpis" className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <h2 id="kpis" className="sr-only">Key indicators</h2>
        {isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Kpi icon={Calendar} label="Active engagements" value={engagements.length} />
            <Kpi icon={AlertTriangle} label="Open major NCs" value={totalOpenMajor} accent="red" />
            <Kpi icon={AlertTriangle} label="Open minor NCs" value={totalOpenMinor} accent="amber" />
            <Kpi icon={Beaker} label="Probes available" value={probesRun} />
          </>
        )}
      </section>

      <section aria-labelledby="quick-actions" className="mt-8">
        <h2 id="quick-actions" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Action icon={FileCheck} label="Start new engagement" onClick={() => trigger('new-engagement')} />
          <Action icon={Beaker} label="Run probe" onClick={() => trigger('run-probe')} />
          <Action icon={AlertTriangle} label="Raise NC" onClick={() => trigger('raise-nc')} />
        </div>
      </section>

      <section aria-labelledby="engagements" className="mt-8">
        <h2 id="engagements" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Engagements</h2>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : engagements.length === 0 ? (
          <EmptyState
            icon={<Calendar />}
            title="No engagements yet"
            description="Use 'Start new engagement' above to plan one."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {engagements.map((e) => (
              <Link
                key={e.id}
                href={`/engagements/${e.id}`}
                className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-slate-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{e.clientId}</div>
                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{e.scopeStatement}</div>
                  </div>
                  <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800">{e.stage}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <span><b>{e.mode}</b> mode</span>
                  <span><b>{e.status.replace(/_/g, ' ')}</b></span>
                  <span><b>{new Date(e.endsOn).toLocaleDateString()}</b> ends</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: number; accent?: 'red' | 'amber' }) {
  const accentColor = accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200';
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={`w-4 h-4 ${accentColor}`} aria-hidden />
      </div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums ${accentColor}`}>{value}</div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="w-4 h-4" aria-hidden /> {label}
    </button>
  );
}
