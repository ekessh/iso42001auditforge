// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual shape preset. */
  shape?: 'rect' | 'pill' | 'circle' | 'text';
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, shape = 'rect', ...rest }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn(
        'bg-shimmer animate-shimmer',
        shape === 'rect' && 'rounded-md',
        shape === 'pill' && 'rounded-full',
        shape === 'circle' && 'rounded-full aspect-square',
        shape === 'text' && 'h-3 rounded',
        className,
      )}
      {...rest}
    >
      <span className="sr-only">Loading…</span>
    </div>
  ),
);
Skeleton.displayName = 'Skeleton';
