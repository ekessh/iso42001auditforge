// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxProgress from '@radix-ui/react-progress';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface ProgressProps
  extends React.ComponentPropsWithoutRef<typeof RxProgress.Root> {
  value?: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  /** Optional label rendered alongside (kept accessible). */
  ariaLabel?: string;
}

export const Progress = React.forwardRef<
  React.ElementRef<typeof RxProgress.Root>,
  ProgressProps
>(({ className, value = 0, tone = 'primary', size = 'md', ariaLabel, ...rest }, ref) => {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <RxProgress.Root
      ref={ref}
      value={clamped}
      aria-label={ariaLabel}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
      {...rest}
    >
      <RxProgress.Indicator
        className={cn(
          'h-full transition-transform duration-base ease-decel',
          tone === 'primary' && 'bg-primary',
          tone === 'success' && 'bg-success',
          tone === 'warning' && 'bg-warning',
          tone === 'danger' && 'bg-destructive',
        )}
        style={{ transform: `translateX(-${100 - clamped}%)` }}
      />
    </RxProgress.Root>
  );
});
Progress.displayName = 'Progress';
