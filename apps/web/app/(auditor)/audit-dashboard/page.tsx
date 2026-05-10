// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Audit Dashboard — v3 §15.14.
 *
 * Real-time progress view for the lead auditor during an active engagement.
 * Picks the first in-progress engagement automatically; users can switch via
 * the Engagement picker.
 */

import { Alert, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { ArrowRight, Calendar } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { AreaCoverageBars } from '@/components/dashboards/AreaCoverageBars';
import { ManDayBurndown } from '@/components/dashboards/ManDayBurndown';
import { RiskIndicator } from '@/components/dashboards/RiskIndicator';
import { ClauseSortTable } from '@/components/dashboards/ClauseSortTable';
import { useAuditDashboard } from '@/lib/hooks/use-coverage';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useWorkspace } from '@/lib/hooks/use-workspace';

export default function AuditDashboardPage() {
  const engagementsQ = useEngagements({ limit: 50 });
  const items = engagementsQ.data?.items ?? [];
  const firstActive = items.find((e) => e.status === 'in_progress') ?? items[0];
  const engagementId = firstActive?.id ?? '';

  const { data, isLoading, error } = useAuditDashboard(engagementId);
  const workspaceQ = useWorkspace(engagementId, firstActive?.mode ?? 'audit');

  if (engagementsQ.isLoading) {
    return <DashboardSkeleton />;
  }

  if (!engagementId) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          icon={<Calendar />}
          title="No engagement selected"
          description="Open or create an engagement to view the audit dashboard."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Alert tone="danger">
          {error instanceof Error ? error.message : 'Failed to load audit dashboard'}
        </Alert>
      </div>
    );
  }

  if (isLoading || !data) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live coverage and progress for the active engagement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RiskIndicator risk={data.risk} />
          <Link
            href={`/workspace/${engagementId}`}
            className="inline-flex items-center gap-1 rounded-md bg-success px-3 py-1.5 text-xs font-medium text-success-foreground hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open workspace <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      <section
        aria-labelledby="kpi-row"
        className="grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        <h2 id="kpi-row" className="sr-only">Key indicators</h2>
        <Kpi label="Coverage" value={`${data.coveragePct}%`} tone={data.coveragePct >= 70 ? 'success' : data.coveragePct >= 50 ? 'warning' : 'destructive'} />
        <Kpi
          label="Candidate findings"
          value={
            data.candidateFindings.major +
            data.candidateFindings.minor +
            data.candidateFindings.ofi +
            data.candidateFindings.observation
          }
          sublabel={`${data.candidateFindings.major} major · ${data.candidateFindings.minor} minor · ${data.candidateFindings.ofi} OFI`}
          tone="warning"
        />
        <Kpi label="Promoted findings" value={data.promotedFindings} tone="info" />
        <Kpi label="Sampling complete" value={`${data.samplingCompletePct}%`} tone={data.samplingCompletePct >= 80 ? 'success' : 'warning'} />
        <Kpi
          label="Man-days"
          value={`${data.manDaysSpent}/${data.manDaysPlanned}`}
          sublabel={`${data.manDaysPlanned > 0 ? Math.round((data.manDaysSpent / data.manDaysPlanned) * 100) : 0}% spent`}
          tone="info"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AreaCoverageBars bars={data.areaBars} />
        <ManDayBurndown points={data.manDays} spent={data.manDaysSpent} planned={data.manDaysPlanned} />
      </div>

      {workspaceQ.data ? (
        <section aria-labelledby="clause-table" className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <h2 id="clause-table" className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            Clause coverage — sortable
          </h2>
          <p className="mt-1 text-2xs text-muted-foreground">
            All clauses in scope with their status, score, and weight. Methodology is logged in the audit ledger.
          </p>
          <div className="mt-3">
            <ClauseSortTable area={workspaceQ.data.coverageArea} />
          </div>
        </section>
      ) : null}

      <section
        aria-labelledby="attention-areas"
        className="rounded-lg border border-border bg-card p-4 shadow-xs"
      >
        <h2
          id="attention-areas"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Quick-jump &middot; areas needing attention
        </h2>
        <ul className="mt-3 space-y-2">
          {data.attentionAreas.map((a) => (
            <li
              key={a.areaId}
              className="flex items-start justify-between gap-3 rounded-md border border-border bg-background p-2.5"
            >
              <div>
                <span className="font-mono text-xs font-semibold text-foreground">{a.areaId}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.reason}</p>
              </div>
              <Link
                href={`/workspace/${engagementId}?area=${a.areaId}`}
                className="inline-flex items-center gap-1 self-center rounded-md border border-border bg-transparent px-2.5 py-1 text-2xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Jump to area <ArrowRight className="size-3" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

interface KpiProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  tone?: 'success' | 'warning' | 'destructive' | 'info';
}

function Kpi({ label, value, sublabel, tone = 'info' }: KpiProps) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'destructive' ? 'text-destructive' : 'text-info';
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-xs">
      <div className="text-2xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {sublabel ? <div className="mt-0.5 text-2xs text-muted-foreground">{sublabel}</div> : null}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
