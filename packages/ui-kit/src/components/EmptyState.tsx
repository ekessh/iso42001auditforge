// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, size = 'md', className, ...rest }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/40 text-center',
        size === 'sm' && 'gap-2 px-4 py-8',
        size === 'md' && 'gap-3 px-6 py-12',
        size === 'lg' && 'gap-4 px-8 py-16',
        className,
      )}
      role="status"
      {...rest}
    >
      {icon ? (
        <div className="flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground ring-1 ring-border [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-md flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  ),
);
EmptyState.displayName = 'EmptyState';
