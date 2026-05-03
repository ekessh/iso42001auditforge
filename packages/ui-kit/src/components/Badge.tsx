// SPDX-License-Identifier: BUSL-1.1
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium leading-none whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral:
          'bg-muted/60 text-muted-foreground border-border',
        primary:
          'bg-primary/10 text-primary border-primary/20',
        success:
          'bg-success/10 text-success border-success/20',
        warning:
          'bg-warning/10 text-warning border-warning/30',
        danger:
          'bg-destructive/10 text-destructive border-destructive/20',
        info: 'bg-info/10 text-info border-info/20',
        outline: 'bg-transparent text-foreground border-border',
      },
      size: {
        xs: 'h-4 px-1.5 text-[10px]',
        sm: 'h-5 px-2 text-2xs',
        md: 'h-6 px-2.5 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone, size, ...rest }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ tone, size }), className)}
      {...rest}
    />
  ),
);
Badge.displayName = 'Badge';
