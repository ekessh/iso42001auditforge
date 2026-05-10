// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import type { SoftConflict, SoftConflictResolution } from '@auditforge/working-papers';

export interface ConflictResolverProps {
  conflicts: SoftConflict[];
  onResolve: (id: string, resolution: SoftConflictResolution) => void;
}

export function ConflictResolver({ conflicts, onResolve }: ConflictResolverProps) {
  if (conflicts.length === 0) return null;
  return (
    <section
      aria-label="Auditor decisions required"
      className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
    >
      <h2 className="font-semibold text-amber-900 dark:text-amber-200">
        {conflicts.length} item{conflicts.length === 1 ? '' : 's'} need your decision
      </h2>
      <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
        Two devices recorded different verdicts on the same checklist item. Pick
        one — your choice is logged in the audit trail.
      </p>
      <ul className="mt-3 space-y-2">
        {conflicts.map((c) => (
          <li key={c.id} className="rounded border border-amber-200 bg-white p-2 dark:border-amber-900/40 dark:bg-amber-950/50">
            <div className="text-xs font-medium text-foreground">{c.itemText || c.itemId}</div>
            <div role="group" aria-label={`Resolve ${c.itemText || c.itemId}`} className="mt-2 flex flex-wrap gap-2">
              {c.branches.map((branch) => (
                <button
                  key={branch.source}
                  type="button"
                  onClick={(): void =>
                    onResolve(c.id, { kind: 'pick', source: branch.source })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Use {branch.source} ({branch.state})
                  {branch.decidedBy ? ` · by ${branch.decidedBy}` : ''}
                </button>
              ))}
              <button
                type="button"
                onClick={(): void => onResolve(c.id, { kind: 'override', state: 'na' })}
                className="rounded border border-border bg-background px-2 py-1 text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Mark N/A
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
