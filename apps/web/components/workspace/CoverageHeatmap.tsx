// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * CoverageHeatmap — per-area clause grid showing evidenced / partial /
 * contradicted / untouched status. Matches v3 §15.11 Coverage tab.
 *
 * Each cell is a button so it can be focused, activated to drill into
 * the evidence chain side panel (drill-down handler is a prop), and
 * announces its status to screen readers.
 *
 * Cells use color *and* text for the status label so we don't lean on
 * color alone (WCAG 2.2 AA — 1.4.1 Use of Color).
 */

import * as React from 'react';

import type { CoverageArea, CoverageStatus } from '@/lib/mocks/workspace-mock';

const STATUS_META: Record<CoverageStatus, { tone: string; label: string; aria: string }> = {
  evidenced: {
    tone: 'border-success/40 bg-success/15 text-foreground',
    label: 'Evidenced',
    aria: 'fully evidenced',
  },
  partial: {
    tone: 'border-warning/40 bg-warning/15 text-foreground',
    label: 'Partial',
    aria: 'partially evidenced',
  },
  contradicted: {
    tone: 'border-destructive/40 bg-destructive/15 text-foreground',
    label: 'Contradicted',
    aria: 'contradicted by claims',
  },
  untouched: {
    tone: 'border-border bg-muted/40 text-muted-foreground',
    label: 'Untouched',
    aria: 'not yet covered',
  },
};

export interface CoverageHeatmapProps {
  area: CoverageArea;
  onCellSelect?: (clauseId: string) => void;
  /** Compact variant used in side panels. */
  compact?: boolean;
}

export function CoverageHeatmap({ area, onCellSelect, compact }: CoverageHeatmapProps) {
  return (
    <section aria-labelledby={`heatmap-${area.id}`} className="space-y-2">
      <header className="flex items-center justify-between">
        <h3
          id={`heatmap-${area.id}`}
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Coverage — {area.title}
        </h3>
        <Legend />
      </header>
      <div
        className={`grid gap-1.5 ${
          compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3'
        }`}
        role="grid"
        aria-label={`Coverage heatmap for ${area.title}`}
      >
        {area.cells.map((cell) => {
          const meta = STATUS_META[cell.status];
          const description = cell.title ?? cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              role="gridcell"
              onClick={() => onCellSelect?.(cell.id)}
              aria-label={`${cell.id} ${description}: ${meta.aria}`}
              className={`flex aspect-[1.6/1] flex-col justify-between rounded-md border px-2 py-1.5 text-left text-2xs transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${meta.tone}`}
            >
              <span className="font-mono text-xs font-semibold text-foreground">{cell.id}</span>
              <span className="text-[10px] opacity-90">{meta.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <ul className="hidden items-center gap-2 text-[10px] text-muted-foreground sm:flex" aria-label="Status legend">
      {(['evidenced', 'partial', 'contradicted', 'untouched'] as CoverageStatus[]).map((s) => {
        const meta = STATUS_META[s];
        return (
          <li key={s} className="inline-flex items-center gap-1">
            <span
              aria-hidden
              className={`size-2 rounded-sm border ${meta.tone}`}
            />
            {meta.label}
          </li>
        );
      })}
    </ul>
  );
}
