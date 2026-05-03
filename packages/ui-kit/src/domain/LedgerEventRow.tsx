// SPDX-License-Identifier: BUSL-1.1
import { ShieldCheck, ShieldX } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';
import { AuditorAvatar, type AuditorRole } from './AuditorAvatar';

export interface LedgerEventRowProps {
  /** Monotonic ledger sequence number. */
  seq: number;
  /** Action verb (e.g. "wp.update", "finding.accept"). */
  action: string;
  /** Human-readable summary. */
  summary: React.ReactNode;
  actor?: { name: string; role: AuditorRole; src?: string };
  timestamp: string;
  /** Hex hash of this event. */
  hash: string;
  /** Hex hash of the previous event (for chain visualization). */
  prevHash?: string;
  /** Whether the chain link verifies. */
  verified?: boolean;
  className?: string;
}

export const LedgerEventRow = ({
  seq,
  action,
  summary,
  actor,
  timestamp,
  hash,
  prevHash,
  verified = true,
  className,
}: LedgerEventRowProps) => (
  <div
    className={cn(
      'grid grid-cols-[auto_1fr_auto] items-start gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0',
      'hover:bg-muted/30',
      className,
    )}
  >
    <div className="flex items-center gap-2 pt-0.5">
      <span className="font-mono text-2xs tabular text-muted-foreground">#{seq.toString().padStart(5, '0')}</span>
      {actor ? <AuditorAvatar name={actor.name} role={actor.role} src={actor.src} size="sm" /> : null}
    </div>
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <code className="font-mono text-2xs text-primary">{action}</code>
        <span className="text-sm text-foreground">{summary}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 font-mono text-[10px] tabular text-muted-foreground">
        {prevHash ? (
          <>
            <span className="opacity-60">prev</span>
            <code className="rounded bg-muted/60 px-1 py-0.5">{prevHash.slice(0, 8)}</code>
            <span aria-hidden>→</span>
          </>
        ) : null}
        <code className="rounded bg-muted/60 px-1 py-0.5">{hash.slice(0, 8)}</code>
        {verified ? (
          <span className="inline-flex items-center gap-0.5 text-success">
            <ShieldCheck className="size-3" aria-hidden />
            verified
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-destructive">
            <ShieldX className="size-3" aria-hidden />
            broken chain
          </span>
        )}
      </div>
    </div>
    <time className="font-mono text-2xs tabular text-muted-foreground" dateTime={timestamp}>
      {timestamp}
    </time>
  </div>
);
