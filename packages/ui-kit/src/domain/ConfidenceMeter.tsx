// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export interface ConfidenceMeterProps {
  /** 0–100 */
  value: number;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export const ConfidenceMeter = ({ value, size = 'sm', showLabel = true, className }: ConfidenceMeterProps) => {
  const v = Math.max(0, Math.min(100, value));
  const tone =
    v >= 80
      ? 'bg-success'
      : v >= 60
        ? 'bg-info'
        : v >= 40
          ? 'bg-warning'
          : 'bg-destructive';
  const segs = 10;
  const filled = Math.round((v / 100) * segs);
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label="Auditor confidence"
      className={cn('inline-flex items-center gap-2', className)}
    >
      <div className={cn('flex gap-0.5', size === 'sm' ? 'h-2' : 'h-2.5')}>
        {Array.from({ length: segs }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'w-1 rounded-sm',
              size === 'md' && 'w-1.5',
              i < filled ? tone : 'bg-muted',
            )}
          />
        ))}
      </div>
      {showLabel ? (
        <span className="font-mono text-2xs tabular text-muted-foreground">{v}%</span>
      ) : null}
    </div>
  );
};
