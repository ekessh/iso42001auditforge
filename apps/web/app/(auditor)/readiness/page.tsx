// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Readiness Dashboard — v3 §15.14.
 *
 * Read-only for lead auditors during Audit Mode engagements; primary
 * surface for AIMS owners in Readiness Mode.
 */

import { Alert, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { Calendar } from 'lucide-react';
import * as React from 'react';

import { AiSystemBars } from '@/components/dashboards/AiSystemBars';
import { AnnexFamilyGrid } from '@/components/dashboards/AnnexFamilyGrid';
import { BlockersList } from '@/components/dashboards/BlockersList';
import { OpenItemsPanel } from '@/components/dashboards/OpenItemsPanel';
import { ReadinessHero } from '@/components/dashboards/ReadinessHero';
import { ReadinessTrendChart } from '@/components/dashboards/ReadinessTrendChart';
import { CoverageHeatmap } from '@/components/workspace/CoverageHeatmap';
import { ClauseSortTable } from '@/components/dashboards/ClauseSortTable';
import { useReadiness } from '@/lib/hooks/use-coverage';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { useWorkspace } from '@/lib/hooks/use-workspace';

export default function ReadinessDashboardPage() {
  const engagementsQ = useEngagements({ limit: 50 });
  const items = engagementsQ.data?.items ?? [];
  const firstReadiness = items.find((e) => e.mode === 'readiness') ?? items[0];
  const engagementId = firstReadiness?.id ?? '';

  const readinessQ = useReadiness(engagementId);
  const workspaceQ = useWorkspace(engagementId, firstReadiness?.mode ?? 'audit');

  const [selectedFamily, setSelectedFamily] = React.useState<string | undefined>('A.7');

  if (engagementsQ.isLoading) {
    return <ReadinessSkeleton />;
  }

  if (!engagementId) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <EmptyState
          icon={<Calendar />}
          title="No engagement available"
          description="Create or open an engagement to see readiness data."
        />
      </div>
    );
  }

  if (readinessQ.error) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Alert tone="danger">
          {readinessQ.error instanceof Error ? readinessQ.error.message : 'Failed to load readiness dashboard'}
        </Alert>
      </div>
    );
  }

  if (readinessQ.isLoading || !readinessQ.data) {
    return <ReadinessSkeleton />;
  }

  const readiness = readinessQ.data;
  const workspace = workspaceQ.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div role="alert" aria-live="polite" className="rounded-lg border-2 border-destructive/60 bg-destructive/5 p-3 text-sm">
        <strong className="font-semibold text-destructive">NOT A CERTIFICATION AUDIT.</strong>{' '}
        <span className="text-destructive/90">Readiness Mode produces a gap assessment only. No conformity assertion is made.
          Do not present these results as a certification statement.</span>
      </div>

      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Readiness Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live AIMS readiness against ISO/IEC 42001 — weighted, drillable, signed methodology.
          </p>
        </div>
        <span className="rounded bg-muted px-2 py-0.5 text-2xs uppercase tracking-wider text-muted-foreground">
          Read-only &middot; lead auditor view
        </span>
      </header>

      <ReadinessHero
        pct={readiness.overallPct}
        delta30d={readiness.trend30dDelta}
        delta90d={readiness.trend90dDelta}
        daysToTarget={readiness.daysToTarget}
        targetDate={readiness.targetCertDate}
        weightDescription={readiness.weights.description}
      />

      <AnnexFamilyGrid
        families={readiness.families}
        selectedId={selectedFamily}
        onSelect={(id) => setSelectedFamily(id)}
      />

      {selectedFamily && workspace ? (
        <section
          aria-labelledby="clause-drilldown"
          className="rounded-lg border border-border bg-card p-4 shadow-xs"
        >
          <h2
            id="clause-drilldown"
            className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Drill-down — {selectedFamily} clause-level heatmap
          </h2>
          <p className="mt-1 text-2xs text-muted-foreground">
            Click a clause to open the evidence chain side panel: claims, source answers, linked findings.
          </p>
          <div className="mt-3">
            <CoverageHeatmap area={workspace.coverageArea} />
          </div>
          <div className="mt-4">
            <ClauseSortTable area={workspace.coverageArea} />
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpenItemsPanel title="Open items" items={readiness.openItems} />
        <BlockersList items={readiness.blockers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReadinessTrendChart
            points={readiness.trend.map((p) => ({
              date: p.date,
              readinessPct: p.readinessPct,
              ...(p.event ? { event: p.event } : {}),
            }))}
          />
        </div>
        <AiSystemBars systems={readiness.aiSystems} />
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}
