// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * OpenItemsPanel — counts and rolling list of improvement items / candidate
 * findings / open formal NCs / OFIs per v3 §15.14.
 *
 * Mode-aware label: "Improvement Items" in Readiness Mode, "Candidate
 * Findings" in Audit Mode. (Caller passes the title string.)
 */

import * as React from 'react';

import type { OpenItem } from '@/lib/mocks/workspace-mock';

const TYPE_TONE: Record<OpenItem['type'], string> = {
  major: 'bg-destructive/15 text-destructive border-destructive/30',
  minor: 'bg-warning/15 text-warning border-warning/30',
  ofi: 'bg-info/15 text-info border-info/30',
  observation: 'bg-muted text-muted-foreground border-border',
};

export interface OpenItemsPanelProps {
  title: string;
  items: OpenItem[];
}

export function OpenItemsPanel({ title, items }: OpenItemsPanelProps) {
  const counts = items.reduce(
    (acc, it) => {
      acc[it.type] = (acc[it.type] ?? 0) + 1;
      return acc;
    },
    {} as Record<OpenItem['type'], number>,
  );
  return (
    <section
      aria-labelledby="open-items"
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex items-center justify-between">
        <h2
          id="open-items"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {title}
        </h2>
        <div className="flex items-center gap-1.5 text-2xs">
          <CountChip label="Major" value={counts.major ?? 0} tone="text-destructive" />
          <CountChip label="Minor" value={counts.minor ?? 0} tone="text-warning" />
          <CountChip label="OFI" value={counts.ofi ?? 0} tone="text-info" />
          <CountChip label="Obs." value={counts.observation ?? 0} tone="text-muted-foreground" />
        </div>
      </header>

      <ul className="mt-3 space-y-1.5">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-start gap-2 rounded-md border border-border bg-background p-2 text-xs"
          >
            <span
              className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${TYPE_TONE[it.type]}`}
            >
              {it.type}
            </span>
            <span className="min-w-0 flex-1 leading-relaxed text-foreground">{it.title}</span>
            <span className="ml-auto whitespace-nowrap text-2xs text-muted-foreground tabular-nums">
              <span className="font-mono">{it.clauseId}</span>
              <span aria-hidden> · </span>
              <span aria-label={`Age ${it.age}`}>{it.age}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CountChip({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-2xs">
      <span className={tone}>{label}</span>
      <b className={`tabular-nums ${tone}`}>{value}</b>
    </span>
  );
}
