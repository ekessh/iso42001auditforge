// SPDX-License-Identifier: BUSL-1.1
'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '../lib/cn';

const inputVariants = cva(
  [
    'flex w-full rounded-md border border-input bg-card text-foreground',
    'placeholder:text-muted-foreground',
    'transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 px-2.5 text-sm',
        md: 'h-9 px-3 text-sm',
        lg: 'h-10 px-3.5 text-base',
      },
    },
    defaultVariants: { size: 'md' },
  },
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, size, iconLeft, iconRight, type = 'text', ...rest }, ref) => {
    if (iconLeft || iconRight) {
      return (
        <div className="relative inline-flex w-full">
          {iconLeft ? (
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex w-8 items-center justify-center text-muted-foreground [&_svg]:size-4"
              aria-hidden
            >
              {iconLeft}
            </span>
          ) : null}
          <input
            ref={ref}
            type={type}
            className={cn(
              inputVariants({ size }),
              iconLeft && 'pl-8',
              iconRight && 'pr-8',
              className,
            )}
            {...rest}
          />
          {iconRight ? (
            <span
              className="pointer-events-none absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground [&_svg]:size-4"
              aria-hidden
            >
              {iconRight}
            </span>
          ) : null}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        type={type}
        className={cn(inputVariants({ size }), className)}
        {...rest}
      />
    );
  },
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[80px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...rest}
  />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }
>(({ className, children, required, ...rest }, ref) => (
  <label
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 text-xs font-medium text-muted-foreground',
      className,
    )}
    {...rest}
  >
    {children}
    {required ? (
      <span className="text-destructive" aria-hidden>
        *
      </span>
    ) : null}
  </label>
));
Label.displayName = 'Label';

export const FieldHint = ({
  children,
  tone = 'muted',
  className,
}: {
  children: React.ReactNode;
  tone?: 'muted' | 'error' | 'success';
  className?: string;
}) => (
  <p
    className={cn(
      'mt-1 text-xs',
      tone === 'muted' && 'text-muted-foreground',
      tone === 'error' && 'text-destructive',
      tone === 'success' && 'text-success',
      className,
    )}
    role={tone === 'error' ? 'alert' : undefined}
  >
    {children}
  </p>
);
