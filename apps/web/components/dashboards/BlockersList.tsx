// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * BlockersList — top clauses preventing readiness, sorted by impact, each
 * with the engine's recommended next action. v3 §15.14.
 */

import { ArrowRight, Flame } from 'lucide-react';
import * as React from 'react';

import type { BlockerItem } from '@/lib/mocks/workspace-mock';

const IMPACT_TONE: Record<BlockerItem['impact'], string> = {
  high: 'bg-destructive/15 text-destructive border-destructive/30',
  medium: 'bg-warning/15 text-warning border-warning/30',
  low: 'bg-muted text-muted-foreground border-border',
};

export interface BlockersListProps {
  items: BlockerItem[];
  onAction?: (id: string) => void;
}

export function BlockersList({ items, onAction }: BlockersListProps) {
  return (
    <section
      aria-labelledby="blockers-list"
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex items-center gap-2">
        <Flame className="size-4 text-destructive" aria-hidden />
        <h2
          id="blockers-list"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Top blockers
        </h2>
      </header>
      <ol className="mt-3 space-y-2">
        {items.map((b, i) => (
          <li
            key={b.id}
            className="flex items-start gap-3 rounded-md border border-border bg-background p-2.5"
          >
            <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold tabular-nums text-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-foreground">{b.clauseId}</span>
                <span className="truncate text-xs text-foreground">{b.clauseTitle}</span>
                <span
                  className={`ml-auto inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${IMPACT_TONE[b.impact]}`}
                >
                  {b.impact}
                </span>
              </div>
              <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{b.recommendedAction}</p>
              <button
                type="button"
                onClick={() => onAction?.(b.id)}
                className="mt-1.5 inline-flex items-center gap-1 text-2xs text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                Open in workspace <ArrowRight className="size-3" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
