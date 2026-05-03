// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md',
    'font-medium select-none transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 shadow-xs',
        secondary:
          'bg-secondary text-secondary-foreground border border-border hover:bg-muted active:bg-muted/80',
        ghost:
          'bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
        outline:
          'border border-border bg-transparent text-foreground hover:bg-muted active:bg-muted/80',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90 active:bg-destructive/95',
        success:
          'bg-success text-success-foreground hover:bg-success/90 active:bg-success/95',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline px-0',
      },
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-5 text-base',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-8 w-8 p-0',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      block: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  /** Optional shortcut hint shown on the right (e.g. "⌘K"). */
  shortcut?: string;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      block,
      asChild,
      loading,
      shortcut,
      iconLeft,
      iconRight,
      children,
      disabled,
      ...rest
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : iconLeft}
        {children}
        {iconRight}
        {shortcut ? (
          <kbd className="ml-2 hidden rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground sm:inline-flex">
            {shortcut}
          </kbd>
        ) : null}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
