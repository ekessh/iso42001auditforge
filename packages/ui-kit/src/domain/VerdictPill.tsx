// SPDX-License-Identifier: BUSL-1.1
import { CheckCircle2, CircleSlash, MinusCircle, OctagonAlert, ShieldAlert, Sparkles } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export type Verdict = 'conformant' | 'minor-nc' | 'major-nc' | 'ofi' | 'na' | 'pending';

const verdictConfig: Record<
  Verdict,
  { label: string; icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>; classes: string }
> = {
  conformant: {
    label: 'Conformant',
    icon: CheckCircle2,
    classes: 'border-success/30 bg-success/10 text-success',
  },
  'minor-nc': {
    label: 'Minor NC',
    icon: ShieldAlert,
    classes: 'border-warning/40 bg-warning/10 text-warning',
  },
  'major-nc': {
    label: 'Major NC',
    icon: OctagonAlert,
    classes: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  ofi: {
    label: 'OFI',
    icon: Sparkles,
    classes: 'border-info/30 bg-info/10 text-info',
  },
  na: {
    label: 'N/A',
    icon: MinusCircle,
    classes: 'border-border bg-muted/60 text-muted-foreground',
  },
  pending: {
    label: 'Pending',
    icon: CircleSlash,
    classes: 'border-border bg-card text-muted-foreground',
  },
};

export interface VerdictPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  verdict: Verdict;
  size?: 'sm' | 'md';
  /** Hide the icon for very dense layouts. */
  iconOnly?: boolean;
}

export const VerdictPill = React.forwardRef<HTMLSpanElement, VerdictPillProps>(
  ({ verdict, size = 'sm', iconOnly, className, ...rest }, ref) => {
    const cfg = verdictConfig[verdict];
    const Icon = cfg.icon;
    return (
      <span
        ref={ref}
        role="status"
        aria-label={cfg.label}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border font-medium tabular',
          size === 'sm' ? 'px-2 py-0.5 text-2xs leading-none' : 'px-2.5 py-1 text-xs leading-none',
          cfg.classes,
          className,
        )}
        {...rest}
      >
        <Icon className={cn(size === 'sm' ? 'size-3' : 'size-3.5')} aria-hidden />
        {iconOnly ? null : cfg.label}
      </span>
    );
  },
);
VerdictPill.displayName = 'VerdictPill';
