// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * WorkspaceHeader — persistent top strip per v3 §15.11.
 *
 * Shows scope selector, engagement, AI system in scope, audit phase,
 * current area, mode pill (Audit / Readiness), session timer.
 */

import { Clock, ChevronDown } from 'lucide-react';
import * as React from 'react';

import type { WorkspaceContext } from '@/lib/mocks/workspace-mock';

export interface WorkspaceHeaderProps {
  ctx: WorkspaceContext;
  modeLabel: string;
  onScopeChange?: (id: string) => void;
}

export function WorkspaceHeader({ ctx, modeLabel, onScopeChange }: WorkspaceHeaderProps) {
  const elapsed = useElapsed(ctx.sessionStartedAt);
  return (
    <header
      className="flex h-12 items-center gap-4 border-b border-border bg-card px-4"
      role="banner"
    >
      <div className="font-semibold tracking-tight">AuditForge</div>
      <button
        type="button"
        onClick={() => onScopeChange?.(ctx.engagementId)}
        className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Change scope or AI system"
      >
        <span className="font-medium text-foreground">{ctx.clientName}</span>
        <span aria-hidden>·</span>
        <span>{ctx.aiSystemInScope}</span>
        <ChevronDown className="size-3" aria-hidden />
      </button>
      <span className="text-2xs text-muted-foreground">
        <span className="text-foreground">{ctx.phase}</span>
        <span aria-hidden> · </span>
        Area: <span className="text-foreground">{ctx.area}</span>
      </span>

      <span
        className="ml-auto inline-flex items-center rounded bg-success/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-success"
        aria-label={`Mode: ${modeLabel}`}
      >
        {modeLabel}
      </span>
      <span className="inline-flex items-center gap-1 text-2xs tabular-nums text-muted-foreground">
        <Clock className="size-3" aria-hidden />
        {elapsed} · day {ctx.sessionDay} of {ctx.sessionTotalDays}
      </span>
    </header>
  );
}

function useElapsed(startISO: string): string {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const start = new Date(startISO).getTime();
  const diff = Math.max(0, now.getTime() - start);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const m = (mins % 60).toString().padStart(2, '0');
  const h = hours.toString().padStart(2, '0');
  return `${h}:${m}`;
}
