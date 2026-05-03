// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * MiniAuditDashboard — compact strip embedded at the top of the
 * Conversational Workspace per v3 §15.14.
 *
 * Surfaces:
 *  - coverage %
 *  - working papers complete / total
 *  - candidate findings count (warning tone)
 *  - man-days spent / planned
 *  - probes run
 *  - LLM tier indicator (Local / Cloud) + model badge
 *
 * No layout shift: fixed-height strip with tabular-nums and reserved space.
 */

import { Cpu, FileText, FlaskConical, Flag, Stamp } from 'lucide-react';
import * as React from 'react';

import type { WorkspaceContext } from '@/lib/mocks/workspace-mock';

export interface MiniAuditDashboardProps {
  ctx: WorkspaceContext;
}

export function MiniAuditDashboard({ ctx }: MiniAuditDashboardProps) {
  return (
    <div
      className="flex h-9 items-center gap-4 border-b border-border bg-card/60 px-3 text-xs"
      role="region"
      aria-label="Audit progress at a glance"
    >
      <Stat
        icon={FileText}
        label={`${ctx.coveragePct}% coverage`}
        emphasis={ctx.coveragePct < 60 ? 'warn' : 'ok'}
      />
      <Stat
        icon={Stamp}
        label={
          <>
            <b className="text-success">{ctx.workingPapersComplete}</b>
            <span className="text-muted-foreground">/{ctx.workingPapersTotal} WPs</span>
          </>
        }
      />
      <Stat
        icon={Flag}
        label={
          <>
            <b className="text-warning">{ctx.candidateFindingsCount}</b>
            <span className="text-muted-foreground"> candidate findings</span>
          </>
        }
      />
      <Stat
        icon={FlaskConical}
        label={
          <>
            <b>{ctx.manDaysSpent}</b>
            <span className="text-muted-foreground">/{ctx.manDaysPlanned} man-days</span>
          </>
        }
      />
      <Stat
        icon={FlaskConical}
        label={
          <>
            <b>{ctx.probesRun}</b>
            <span className="text-muted-foreground"> probes run</span>
          </>
        }
      />
      <div className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground">
        <span
          aria-hidden
          className={`size-1.5 rounded-full ${ctx.llmTier === 'local' ? 'bg-success' : 'bg-info'}`}
        />
        <Cpu className="size-3.5" aria-hidden />
        <span className="font-mono">
          {ctx.llmTier === 'local' ? 'Local' : 'Cloud'} · {ctx.llmModelLabel}
        </span>
      </div>
    </div>
  );
}

interface StatProps {
  icon: React.ElementType;
  label: React.ReactNode;
  emphasis?: 'ok' | 'warn';
}

function Stat({ icon: Icon, label, emphasis }: StatProps) {
  const tone =
    emphasis === 'warn'
      ? 'text-warning'
      : emphasis === 'ok'
        ? 'text-success'
        : 'text-foreground';
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      <Icon className={`size-3.5 ${tone}`} aria-hidden />
      <span className={tone}>{label}</span>
    </span>
  );
}
