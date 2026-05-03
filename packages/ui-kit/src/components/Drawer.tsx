// SPDX-License-Identifier: BUSL-1.1
'use client';

import { X } from 'lucide-react';
import * as React from 'react';
import { Drawer as Vaul } from 'vaul';

import { cn } from '../lib/cn';

export const Drawer = ({
  shouldScaleBackground = true,
  ...rest
}: React.ComponentProps<typeof Vaul.Root>) => (
  <Vaul.Root shouldScaleBackground={shouldScaleBackground} {...rest} />
);

export const DrawerTrigger = Vaul.Trigger;
export const DrawerClose = Vaul.Close;
export const DrawerPortal = Vaul.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof Vaul.Overlay>,
  React.ComponentPropsWithoutRef<typeof Vaul.Overlay>
>(({ className, ...rest }, ref) => (
  <Vaul.Overlay
    ref={ref}
    className={cn('fixed inset-0 bg-neutral-950/60 backdrop-blur-sm', className)}
    style={{ zIndex: 50 }}
    {...rest}
  />
));
DrawerOverlay.displayName = 'DrawerOverlay';

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof Vaul.Content>,
  React.ComponentPropsWithoutRef<typeof Vaul.Content>
>(({ className, children, ...rest }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <Vaul.Content
      ref={ref}
      style={{ zIndex: 50 }}
      className={cn(
        'fixed inset-x-0 bottom-0 mt-24 flex h-auto flex-col rounded-t-xl border border-border bg-card text-card-foreground',
        'focus:outline-none',
        className,
      )}
      {...rest}
    >
      <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-border" aria-hidden />
      {children}
    </Vaul.Content>
  </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

export const DrawerHeader = ({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-start justify-between gap-2 border-b border-border p-4', className)} {...rest}>
    <div className="flex flex-col gap-1">{children}</div>
    <DrawerClose
      className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Close"
    >
      <X className="size-4" aria-hidden />
    </DrawerClose>
  </div>
);

export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof Vaul.Title>,
  React.ComponentPropsWithoutRef<typeof Vaul.Title>
>(({ className, ...rest }, ref) => (
  <Vaul.Title
    ref={ref}
    className={cn('text-base font-semibold leading-tight', className)}
    {...rest}
  />
));
DrawerTitle.displayName = 'DrawerTitle';

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof Vaul.Description>,
  React.ComponentPropsWithoutRef<typeof Vaul.Description>
>(({ className, ...rest }, ref) => (
  <Vaul.Description
    ref={ref}
    className={cn('text-xs text-muted-foreground', className)}
    {...rest}
  />
));
DrawerDescription.displayName = 'DrawerDescription';
