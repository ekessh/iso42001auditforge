// SPDX-License-Identifier: BUSL-1.1
'use client';
import Link from 'next/link';
import { listEngagements } from '@/lib/mocks/engagements';
import { Calendar, AlertTriangle, FileCheck, Beaker } from 'lucide-react';

export default function DashboardPage() {
  const engagements = listEngagements();
  const totalOpenMajor = engagements.reduce((s, e) => s + e.openFindings.major, 0);
  const totalOpenMinor = engagements.reduce((s, e) => s + e.openFindings.minor, 0);
  const probesRun = engagements.reduce((s, e) => s + e.probesRun, 0);
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm text-slate-500 mt-1">{engagements.length} active engagements</p>

      <section aria-labelledby="kpis" className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={Calendar} label="Active engagements" value={engagements.length} />
        <Kpi icon={AlertTriangle} label="Open major NCs" value={totalOpenMajor} accent="red" />
        <Kpi icon={AlertTriangle} label="Open minor NCs" value={totalOpenMinor} accent="amber" />
        <Kpi icon={Beaker} label="Probes executed" value={probesRun} />
      </section>

      <section aria-labelledby="engagements" className="mt-8">
        <h2 id="engagements" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Engagements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {engagements.map((e) => (
            <Link
              key={e.id}
              href={`/engagements/${e.id}`}
              className="block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 hover:border-slate-400 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{e.clientName}</div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{e.scope}</div>
                </div>
                <span className="px-2 py-0.5 text-xs rounded bg-slate-100 dark:bg-slate-800">{e.lifecycleStage}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <span><b>{e.aiSystems}</b> AI systems</span>
                <span><b>{e.workingPapers.complete}/{e.workingPapers.total}</b> WPs</span>
                <span><b>{e.manDaysSpent}/{e.manDaysPlanned}</b> man-days</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="quick-actions" className="mt-8">
        <h2 id="quick-actions" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-3">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <Action icon={FileCheck} label="Start new engagement" />
          <Action icon={Beaker} label="Run probe" />
          <Action icon={AlertTriangle} label="Raise NC" />
        </div>
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

function Action({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400">
      <Icon className="w-4 h-4" aria-hidden /> {label}
    </button>
  );
}
