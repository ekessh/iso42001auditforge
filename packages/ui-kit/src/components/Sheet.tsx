// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxDialog from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Sheet = RxDialog.Root;
export const SheetTrigger = RxDialog.Trigger;
export const SheetClose = RxDialog.Close;
export const SheetPortal = RxDialog.Portal;

const sheetVariants = cva(
  [
    'fixed bg-card text-card-foreground border-border shadow-xl',
    'focus:outline-none',
    'data-[state=open]:animate-fade-in',
  ],
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b',
        bottom: 'inset-x-0 bottom-0 border-t',
        left: 'inset-y-0 left-0 h-full w-3/4 max-w-sm border-r',
        right: 'inset-y-0 right-0 h-full w-3/4 max-w-md border-l',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

export const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof RxDialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Overlay>
>(({ className, ...rest }, ref) => (
  <RxDialog.Overlay
    ref={ref}
    style={{ zIndex: 50 }}
    className={cn(
      'fixed inset-0 bg-neutral-950/60 backdrop-blur-sm',
      'data-[state=open]:animate-fade-in',
      className,
    )}
    {...rest}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof RxDialog.Content>,
    VariantProps<typeof sheetVariants> {}

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof RxDialog.Content>,
  SheetContentProps
>(({ className, children, side = 'right', ...rest }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <RxDialog.Content
      ref={ref}
      style={{ zIndex: 50 }}
      className={cn(sheetVariants({ side }), className)}
      {...rest}
    >
      {children}
      <RxDialog.Close
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Close"
      >
        <X className="size-4" aria-hidden />
      </RxDialog.Close>
    </RxDialog.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

export const SheetHeader = ({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1 border-b border-border p-4', className)} {...rest} />
);

export const SheetFooter = ({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end', className)} {...rest} />
);

export const SheetTitle = React.forwardRef<
  React.ElementRef<typeof RxDialog.Title>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Title>
>(({ className, ...rest }, ref) => (
  <RxDialog.Title ref={ref} className={cn('text-base font-semibold', className)} {...rest} />
));
SheetTitle.displayName = 'SheetTitle';

export const SheetDescription = React.forwardRef<
  React.ElementRef<typeof RxDialog.Description>,
  React.ComponentPropsWithoutRef<typeof RxDialog.Description>
>(({ className, ...rest }, ref) => (
  <RxDialog.Description
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...rest}
  />
));
SheetDescription.displayName = 'SheetDescription';
