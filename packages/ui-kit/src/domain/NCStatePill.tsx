// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export type NCState =
  | 'open'
  | 'proposed'
  | 'accepted'
  | 'implemented'
  | 'verified'
  | 'closed'
  | 'rejected';

const cfg: Record<NCState, { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'border-destructive/30 bg-destructive/10 text-destructive' },
  proposed: { label: 'CA Proposed', tone: 'border-warning/40 bg-warning/10 text-warning' },
  accepted: { label: 'CA Accepted', tone: 'border-info/30 bg-info/10 text-info' },
  implemented: { label: 'Implemented', tone: 'border-primary/30 bg-primary/10 text-primary' },
  verified: { label: 'Verified', tone: 'border-success/30 bg-success/10 text-success' },
  closed: { label: 'Closed', tone: 'border-border bg-muted text-muted-foreground' },
  rejected: { label: 'Rejected', tone: 'border-destructive/30 bg-destructive/10 text-destructive' },
};

export const NCStatePill = ({
  state,
  className,
}: {
  state: NCState;
  className?: string;
}) => {
  const c = cfg[state];
  return (
    <span
      role="status"
      aria-label={`Nonconformity state: ${c.label}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium tabular',
        c.tone,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {c.label}
    </span>
  );
};
