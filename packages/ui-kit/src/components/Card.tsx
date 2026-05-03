// SPDX-License-Identifier: BUSL-1.1
import * as React from 'react';

import { cn } from '../lib/cn';

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }
>(({ className, interactive, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border border-border bg-card text-card-foreground shadow-xs',
      interactive &&
        'transition-colors hover:border-ring/40 hover:shadow-sm focus-within:border-ring focus-within:shadow-sm',
      className,
    )}
    {...rest}
  />
));
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-1 p-4 pb-2', className)}
    {...rest}
  />
));
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...rest }, ref) => (
  <h3
    ref={ref}
    className={cn('text-sm font-semibold leading-tight tracking-tight', className)}
    {...rest}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...rest }, ref) => (
  <p
    ref={ref}
    className={cn('text-xs text-muted-foreground leading-relaxed', className)}
    {...rest}
  />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div ref={ref} className={cn('p-4 pt-2', className)} {...rest} />
));
CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...rest }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center justify-between gap-2 border-t border-border px-4 py-3', className)}
    {...rest}
  />
));
CardFooter.displayName = 'CardFooter';
