// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';

import { cn } from '../lib/cn';

export interface TraceSpan {
  id: string;
  name: string;
  /** ms offset from trace start. */
  start: number;
  /** ms duration. */
  duration: number;
  /** depth/lane for nesting. */
  depth?: number;
  kind?: 'llm' | 'tool' | 'retrieval' | 'function' | 'agent' | 'http';
  status?: 'ok' | 'error' | 'pending';
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceTimelineProps {
  spans: TraceSpan[];
  /** Total trace duration in ms (defaults to max end). */
  total?: number;
  onSpanClick?: (span: TraceSpan) => void;
  className?: string;
}

const kindColor: Record<NonNullable<TraceSpan['kind']>, string> = {
  llm: 'bg-primary/80 hover:bg-primary',
  tool: 'bg-violet-600/80 hover:bg-violet-600',
  retrieval: 'bg-teal-600/80 hover:bg-teal-600',
  function: 'bg-amber-600/80 hover:bg-amber-600',
  agent: 'bg-info/80 hover:bg-info',
  http: 'bg-neutral-500/80 hover:bg-neutral-500',
};

export const TraceTimeline = ({ spans, total, onSpanClick, className }: TraceTimelineProps) => {
  const totalDuration = total ?? Math.max(1, ...spans.map((s) => s.start + s.duration));
  const maxDepth = Math.max(0, ...spans.map((s) => s.depth ?? 0));
  const laneHeight = 22;
  return (
    <div className={cn('rounded-md border border-border bg-card', className)}>
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-2xs text-muted-foreground">
        <span>Trace · {spans.length} spans</span>
        <span className="font-mono tabular">{totalDuration.toFixed(0)} ms</span>
      </header>
      <div
        className="relative w-full overflow-hidden"
        style={{ height: (maxDepth + 1) * laneHeight + 10 }}
        role="img"
        aria-label={`Trace timeline with ${spans.length} spans`}
      >
        {/* Time grid */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute top-0 h-full border-l border-border/60"
            style={{ left: `${(i / 4) * 100}%` }}
          />
        ))}
        {spans.map((span) => {
          const left = (span.start / totalDuration) * 100;
          const width = Math.max(0.4, (span.duration / totalDuration) * 100);
          const top = 5 + (span.depth ?? 0) * laneHeight;
          const color = span.kind ? kindColor[span.kind] : 'bg-muted-foreground/60 hover:bg-muted-foreground';
          return (
            <button
              key={span.id}
              type="button"
              onClick={() => onSpanClick?.(span)}
              className={cn(
                'group absolute flex items-center rounded-sm text-2xs leading-none text-white transition-colors',
                color,
                span.status === 'error' && 'ring-2 ring-destructive ring-offset-1',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
              style={{ left: `${left}%`, width: `${width}%`, top, height: laneHeight - 4 }}
              title={`${span.name} — ${span.duration.toFixed(0)}ms`}
            >
              <span className="truncate px-1.5">{span.name}</span>
            </button>
          );
        })}
      </div>
      <footer className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-1.5 text-2xs text-muted-foreground">
        {(['llm', 'tool', 'retrieval', 'function', 'agent', 'http'] as const).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className={cn('inline-block size-2 rounded-sm', kindColor[k])} aria-hidden />
            {k}
          </span>
        ))}
      </footer>
    </div>
  );
};
