// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export type DiffOp = 'equal' | 'add' | 'remove';
export interface DiffLine {
  op: DiffOp;
  text: string;
  oldNumber?: number;
  newNumber?: number;
}

export interface DiffProps {
  lines: DiffLine[];
  mode?: 'inline' | 'side-by-side';
  className?: string;
  ariaLabel?: string;
}

/** Pre-computed diff renderer. Caller is expected to compute the diff (e.g. with diff-match-patch). */
export const Diff = ({ lines, mode = 'inline', className, ariaLabel }: DiffProps) => {
  if (mode === 'side-by-side') {
    return (
      <div
        className={cn('grid grid-cols-2 overflow-hidden rounded-md border border-border bg-card font-mono text-xs', className)}
        role="region"
        aria-label={ariaLabel ?? 'Diff (side by side)'}
      >
        <div className="border-r border-border bg-muted/30">
          <header className="px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            Before
          </header>
          {lines.map((l, i) => (
            <DiffRow key={`l-${i}`} line={l} side="left" />
          ))}
        </div>
        <div>
          <header className="px-3 py-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
            After
          </header>
          {lines.map((l, i) => (
            <DiffRow key={`r-${i}`} line={l} side="right" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label={ariaLabel ?? 'Diff (inline)'}
      className={cn('overflow-hidden rounded-md border border-border bg-card font-mono text-xs', className)}
    >
      {lines.map((l, i) => (
        <DiffRow key={i} line={l} side="inline" />
      ))}
    </div>
  );
};

const DiffRow = ({ line, side }: { line: DiffLine; side: 'left' | 'right' | 'inline' }) => {
  const visible =
    side === 'left' ? line.op !== 'add' : side === 'right' ? line.op !== 'remove' : true;
  if (!visible) {
    return <div className="h-[18px] bg-muted/20" aria-hidden />;
  }
  return (
    <div
      className={cn(
        'flex border-l-2 px-2 leading-[18px]',
        line.op === 'add' && 'border-success/60 bg-success/10',
        line.op === 'remove' && 'border-destructive/60 bg-destructive/10',
        line.op === 'equal' && 'border-transparent',
      )}
    >
      <span
        aria-hidden
        className="mr-2 inline-block w-7 shrink-0 select-none text-right text-muted-foreground"
      >
        {side === 'right' ? line.newNumber : line.oldNumber}
      </span>
      <span className="mr-2 inline-block w-3 select-none">
        {line.op === 'add' ? '+' : line.op === 'remove' ? '-' : ' '}
      </span>
      <span className="whitespace-pre-wrap break-all">{line.text}</span>
    </div>
  );
};
