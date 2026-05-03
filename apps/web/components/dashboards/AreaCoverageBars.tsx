// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * AreaCoverageBars — per-area planned-vs-covered horizontal bars per
 * v3 §15.14.
 *
 * Renders a stacked bar where the filled portion shows clauses covered
 * relative to planned. Width is animated only when prefers-reduced-motion
 * is unset.
 */

import * as React from 'react';

import type { AreaCoverageBar } from '@/lib/mocks/workspace-mock';

export interface AreaCoverageBarsProps {
  bars: AreaCoverageBar[];
  onAreaJump?: (areaId: string) => void;
}

export function AreaCoverageBars({ bars, onAreaJump }: AreaCoverageBarsProps) {
  return (
    <section
      aria-labelledby="area-coverage"
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex items-center justify-between">
        <h2
          id="area-coverage"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Per-area coverage (planned vs covered)
        </h2>
      </header>
      <ul className="mt-3 space-y-2">
        {bars.map((b) => {
          const pct = Math.round((b.covered / Math.max(1, b.planned)) * 100);
          const tone =
            pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';
          return (
            <li key={b.areaId}>
              <button
                type="button"
                onClick={() => onAreaJump?.(b.areaId)}
                className="block w-full rounded-md p-1 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${b.areaTitle}: ${b.covered} of ${b.planned} clauses covered (${pct}%). Open in workspace.`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium text-foreground">{b.areaTitle}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    <b className="text-foreground">{b.covered}</b>/{b.planned} <span className="text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted motion-safe:transition-all"
                >
                  <div className={`h-full rounded-full ${tone} motion-safe:transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
