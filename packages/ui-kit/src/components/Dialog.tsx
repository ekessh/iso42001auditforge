// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Dialog = RxDialog.Root;
export const DialogTrigger = RxDialog.Trigger;
export const DialogClose = RxDialog.Close;

export const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof RxDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Overlay>
>(({ className, ...rest }, ref) => (
  <RxDialog.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 bg-neutral-950/60 backdrop-blur-sm',
      'data-[state=open]:animate-fade-in data-[state=closed]:opacity-0',
      className,
    )}
    style={{ zIndex: 50 }}
    {...rest}
  />
));
DialogOverlay.displayName = 'DialogOverlay';

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof RxDialog.Content> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RxDialog.Content>,
  DialogContentProps
>(({ className, children, size = 'md', ...rest }, ref) => (
  <RxDialog.Portal>
    <DialogOverlay />
    <RxDialog.Content
      ref={ref}
      style={{ zIndex: 50 }}
      className={cn(
        'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
        'w-[calc(100vw-2rem)] rounded-lg border border-border bg-card text-card-foreground shadow-xl',
        'focus:outline-none',
        'data-[state=open]:animate-slide-up',
        size === 'sm' && 'max-w-md',
        size === 'md' && 'max-w-lg',
        size === 'lg' && 'max-w-2xl',
        size === 'xl' && 'max-w-4xl',
        className,
      )}
      {...rest}
    >
      {children}
      <RxDialog.Close
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close dialog"
      >
        <X className="size-4" aria-hidden />
      </RxDialog.Close>
    </RxDialog.Content>
  </RxDialog.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-1.5 border-b border-border p-4 pb-3', className)}
    {...rest}
  />
);

export const DialogFooter = ({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end',
      className,
    )}
    {...rest}
  />
);

export const DialogTitle = React.forwardRef<
  React.ElementRef<typeof RxDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Title>
>(({ className, ...rest }, ref) => (
  <RxDialog.Title
    ref={ref}
    className={cn('text-base font-semibold leading-tight', className)}
    {...rest}
  />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof RxDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Description>
>(({ className, ...rest }, ref) => (
  <RxDialog.Description
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...rest}
  />
));
DialogDescription.displayName = 'DialogDescription';
