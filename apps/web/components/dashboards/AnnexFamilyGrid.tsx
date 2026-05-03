// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * AnnexFamilyGrid — 9 control-family cards (A.2 through A.10) per
 * v3 §15.14.
 *
 * Each card shows family ID, title, % readiness, evidenced/partial/
 * untouched counts, color-coded status, and is clickable to drill in.
 */

import * as React from 'react';

import type { AnnexFamily } from '@/lib/mocks/workspace-mock';

const STATUS_TONE: Record<AnnexFamily['status'], string> = {
  green: 'border-success/40 bg-success/5',
  amber: 'border-warning/40 bg-warning/5',
  red: 'border-destructive/40 bg-destructive/5',
  grey: 'border-border bg-muted/30',
};

const STATUS_DOT: Record<AnnexFamily['status'], string> = {
  green: 'bg-success',
  amber: 'bg-warning',
  red: 'bg-destructive',
  grey: 'bg-muted-foreground',
};

export interface AnnexFamilyGridProps {
  families: AnnexFamily[];
  selectedId?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}

export function AnnexFamilyGrid({ families, selectedId, onSelect }: AnnexFamilyGridProps) {
  return (
    <section aria-labelledby="annex-grid">
      <h2
        id="annex-grid"
        className="mb-3 text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Annex A — control families
      </h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {families.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onSelect?.(f.id)}
              aria-pressed={selectedId === f.id}
              className={`block w-full rounded-lg border p-3 text-left shadow-xs transition-colors hover:border-ring/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                STATUS_TONE[f.status]
              } ${selectedId === f.id ? 'ring-2 ring-ring' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-foreground">
                  <span aria-hidden className={`size-1.5 rounded-full ${STATUS_DOT[f.status]}`} />
                  {f.id}
                </span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{f.readinessPct}%</span>
              </div>
              <div className="mt-1 text-xs font-medium text-foreground">{f.title}</div>
              <div className="text-2xs text-muted-foreground">{f.description}</div>
              <dl className="mt-2 grid grid-cols-3 gap-1 text-2xs">
                <Counter label="Evidenced" value={f.evidenced} tone="text-success" />
                <Counter label="Partial" value={f.partial} tone="text-warning" />
                <Counter label="Untouched" value={f.untouched} tone="text-muted-foreground" />
              </dl>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={`tabular-nums text-xs font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}
