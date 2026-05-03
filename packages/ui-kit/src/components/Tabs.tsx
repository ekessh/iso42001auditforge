// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxTabs from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Tabs = RxTabs.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RxTabs.List>,
  React.ComponentPropsWithoutRef<typeof RxTabs.List> & { underline?: boolean }
>(({ className, underline = true, ...rest }, ref) => (
  <RxTabs.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1 text-muted-foreground',
      underline ? 'border-b border-border' : 'rounded-md bg-muted p-1',
      className,
    )}
    {...rest}
  />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RxTabs.Trigger>,
  React.ComponentPropsWithoutRef<typeof RxTabs.Trigger> & {
    underline?: boolean;
    badge?: React.ReactNode;
  }
>(({ className, underline = true, badge, children, ...rest }, ref) => (
  <RxTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
      'disabled:pointer-events-none disabled:opacity-50',
      underline
        ? [
            'h-9 border-b-2 border-transparent px-3 -mb-px',
            'hover:text-foreground',
            'data-[state=active]:border-primary data-[state=active]:text-foreground',
          ]
        : [
            'h-7 rounded-sm px-2.5',
            'data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs',
          ],
      className,
    )}
    {...rest}
  >
    {children}
    {badge ? (
      <span className="rounded-full bg-muted px-1.5 text-2xs font-medium text-muted-foreground">
        {badge}
      </span>
    ) : null}
  </RxTabs.Trigger>
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof RxTabs.Content>,
  React.ComponentPropsWithoutRef<typeof RxTabs.Content>
>(({ className, ...rest }, ref) => (
  <RxTabs.Content
    ref={ref}
    className={cn(
      'mt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
      className,
    )}
    {...rest}
  />
));
TabsContent.displayName = 'TabsContent';
