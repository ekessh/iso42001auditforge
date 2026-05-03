// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * Readiness Dashboard — v3 §15.14.
 *
 * Read-only for lead auditors during Audit Mode engagements; primary
 * surface for AIMS owners in Readiness Mode. Real-time when WebSocket
 * push lands; mocked here.
 *
 * Layout (top → bottom, responsive):
 *   1. Hero strip (overall %, trend deltas, target cert countdown,
 *      "How is this calculated?")
 *   2. Annex A control grid (A.2-A.10) as 9 cards
 *   3. Drill-down clause heatmap on family selection
 *   4. Open items / blockers / trend / AI system breakdown
 */

import { Skeleton } from '@auditforge/ui-kit';
import * as React from 'react';

import { AiSystemBars } from '@/components/dashboards/AiSystemBars';
import { AnnexFamilyGrid } from '@/components/dashboards/AnnexFamilyGrid';
import { BlockersList } from '@/components/dashboards/BlockersList';
import { OpenItemsPanel } from '@/components/dashboards/OpenItemsPanel';
import { ReadinessHero } from '@/components/dashboards/ReadinessHero';
import { ReadinessTrendChart } from '@/components/dashboards/ReadinessTrendChart';
import { CoverageHeatmap } from '@/components/workspace/CoverageHeatmap';
import { useReadiness } from '@/lib/hooks/use-coverage';
import { useWorkspace } from '@/lib/hooks/use-workspace';

export default function ReadinessDashboardPage() {
  const { data: readiness, isLoading } = useReadiness();
  // Reuse the workspace mock to source a clause-level heatmap for the
  // currently-selected family. Production: separate ClauseGrid query.
  const { data: workspace } = useWorkspace('eng-001', 'audit');

  const [selectedFamily, setSelectedFamily] = React.useState<string | undefined>('A.7');

  if (isLoading || !readiness) {
    return <ReadinessSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Readiness Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live AIMS readiness against ISO/IEC 42001 — weighted, drillable, signed methodology.
          </p>
        </div>
        <span className="rounded bg-muted px-2 py-0.5 text-2xs uppercase tracking-wider text-muted-foreground">
          Read-only · lead auditor view
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
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpenItemsPanel title="Open items" items={readiness.openItems} />
        <BlockersList items={readiness.blockers} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ReadinessTrendChart points={readiness.trend} />
        </div>
        <AiSystemBars systems={readiness.aiSystems} />
      </div>
    </div>
  );
}

function ReadinessSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
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
