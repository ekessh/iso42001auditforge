// SPDX-License-Identifier: BUSL-1.1
import { Minus, Plus } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { Badge } from '../components/Badge';

export interface ToolACLEntry {
  name: string;
  scope: 'read' | 'write' | 'destructive' | 'metadata';
  /** Allowed in declared ACL. */
  declared: boolean;
  /** Observed in production traces. */
  observed: boolean;
  callCount?: number;
}

export interface ToolACLDriftDiffProps {
  entries: ToolACLEntry[];
  className?: string;
}

const scopeTone = {
  read: 'neutral',
  write: 'warning',
  destructive: 'danger',
  metadata: 'info',
} as const;

export const ToolACLDriftDiff = ({ entries, className }: ToolACLDriftDiffProps) => {
  const drift = entries.filter((e) => e.declared !== e.observed);
  return (
    <div className={cn('overflow-hidden rounded-md border border-border bg-card', className)}>
      <header className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2 text-xs">
        <span className="font-medium">Tool ACL drift</span>
        <span className="font-mono tabular text-muted-foreground">
          {drift.length} drift / {entries.length} total
        </span>
      </header>
      <ul className="divide-y divide-border">
        {entries.map((e) => {
          const undeclaredCall = !e.declared && e.observed;
          const unusedDeclaration = e.declared && !e.observed;
          return (
            <li key={e.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="flex size-5 items-center justify-center rounded-full" aria-hidden>
                {undeclaredCall ? (
                  <Plus className="size-3.5 text-destructive" />
                ) : unusedDeclaration ? (
                  <Minus className="size-3.5 text-warning" />
                ) : (
                  <span className="size-1.5 rounded-full bg-success" />
                )}
              </span>
              <span className="flex-1 truncate font-mono">{e.name}</span>
              <Badge tone={scopeTone[e.scope]} size="xs">
                {e.scope}
              </Badge>
              {e.callCount !== undefined ? (
                <span className="font-mono tabular text-2xs text-muted-foreground">
                  {e.callCount.toLocaleString()} calls
                </span>
              ) : null}
              <span
                className={cn(
                  'inline-flex h-5 min-w-[64px] items-center justify-center rounded text-2xs font-medium',
                  undeclaredCall && 'bg-destructive/10 text-destructive',
                  unusedDeclaration && 'bg-warning/10 text-warning',
                  !undeclaredCall && !unusedDeclaration && 'bg-success/10 text-success',
                )}
              >
                {undeclaredCall ? 'undeclared' : unusedDeclaration ? 'unused' : 'aligned'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
