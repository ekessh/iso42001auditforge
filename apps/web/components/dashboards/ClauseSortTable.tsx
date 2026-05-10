// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@auditforge/ui-kit';

interface Cell {
  id: string;
  title?: string;
  status: 'evidenced' | 'partial' | 'contradicted' | 'untouched';
}

const STATUS_SCORE: Record<Cell['status'], number> = {
  evidenced: 1,
  partial: 0.5,
  contradicted: 0,
  untouched: 0,
};

const STATUS_TONE: Record<Cell['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  evidenced: 'success',
  partial: 'warning',
  contradicted: 'danger',
  untouched: 'neutral',
};

type SortKey = 'id' | 'status' | 'score' | 'weight';

function clauseWeight(id: string): number {
  if (id.startsWith('A.')) return 1.0;
  // Mandatory clauses 4-10
  const head = id.split('.')[0];
  const n = Number(head);
  if (Number.isFinite(n) && n >= 4 && n <= 10) return 1.5;
  return 1.0;
}

export function ClauseSortTable({ area }: { area: { id: string; title: string; cells: Cell[] } }) {
  const [sortKey, setSortKey] = React.useState<SortKey>('id');
  const [asc, setAsc] = React.useState(true);

  const rows = React.useMemo(() => {
    const enriched = area.cells.map((c) => ({
      ...c,
      score: STATUS_SCORE[c.status],
      weight: clauseWeight(c.id),
    }));
    enriched.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'id') cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'score') cmp = a.score - b.score;
      else if (sortKey === 'weight') cmp = a.weight - b.weight;
      return asc ? cmp : -cmp;
    });
    return enriched;
  }, [area.cells, sortKey, asc]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  };

  const Th = ({ k, children, align = 'left' }: { k: SortKey; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th className={`py-2 px-2 text-2xs uppercase tracking-wide font-medium text-muted-foreground ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => handleSort(k)}
        aria-sort={sortKey === k ? (asc ? 'ascending' : 'descending') : 'none'}
        className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
      >
        {children}
        {sortKey === k ? (asc ? <ChevronUp className="size-3" aria-hidden /> : <ChevronDown className="size-3" aria-hidden />) : null}
      </button>
    </th>
  );

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground py-4">No clauses in this area.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" aria-label={`Clause table for ${area.title}`}>
        <thead className="border-b border-border">
          <tr>
            <Th k="id">Clause</Th>
            <th className="py-2 px-2 text-2xs uppercase tracking-wide text-muted-foreground text-left">Title</th>
            <Th k="status">Status</Th>
            <Th k="score" align="right">Score</Th>
            <Th k="weight" align="right">Weight</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              <td className="py-2 px-2 font-mono text-xs">{r.id}</td>
              <td className="py-2 px-2 text-xs text-muted-foreground truncate max-w-md">{r.title ?? '—'}</td>
              <td className="py-2 px-2">
                <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{r.score.toFixed(2)}</td>
              <td className="py-2 px-2 text-right tabular-nums">{r.weight.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
