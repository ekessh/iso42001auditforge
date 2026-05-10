// SPDX-License-Identifier: BUSL-1.1
'use client';

import type { CoverageDeltaItem } from '@/lib/hooks/use-live-interview';

interface Props {
  items: CoverageDeltaItem[];
}

export function CoverageDeltaSidebar({ items }: Props) {
  return (
    <aside
      aria-label="Coverage delta"
      className="flex h-full min-h-0 flex-col rounded-md border border-border bg-background"
    >
      <header className="border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Newly evidenced</h2>
        <p className="text-xs text-muted-foreground">
          Clauses attached to segments this session.
        </p>
      </header>
      <ul className="flex-1 overflow-y-auto p-3 text-sm" aria-live="polite">
        {items.length === 0 ? (
          <li className="text-muted-foreground">No coverage delta yet.</li>
        ) : (
          items.map((c) => (
            <li
              key={`${c.clauseId}-${c.segmentId}`}
              className="flex items-center justify-between rounded-sm border border-border px-2 py-1 mb-1"
            >
              <span className="font-mono text-xs">{c.clauseId}</span>
              <span className="text-xs text-muted-foreground">
                {(c.confidence * 100).toFixed(0)}%
              </span>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
