// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxContext from '@radix-ui/react-context-menu';
import { Check } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const ContextMenu = RxContext.Root;
export const ContextMenuTrigger = RxContext.Trigger;
export const ContextMenuGroup = RxContext.Group;

export const ContextMenuContent = React.forwardRef<
  React.ElementRef<typeof RxContext.Content>,
  React.ComponentPropsWithoutRef<typeof RxContext.Content>
>(({ className, ...rest }, ref) => (
  <RxContext.Portal>
    <RxContext.Content
      ref={ref}
      style={{ zIndex: 60 }}
      className={cn(
        'min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...rest}
    />
  </RxContext.Portal>
));
ContextMenuContent.displayName = 'ContextMenuContent';

export const ContextMenuItem = React.forwardRef<
  React.ElementRef<typeof RxContext.Item>,
  React.ComponentPropsWithoutRef<typeof RxContext.Item> & { shortcut?: string }
>(({ className, children, shortcut, ...rest }, ref) => (
  <RxContext.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-muted data-[highlighted]:bg-muted',
      '[&_svg]:size-4',
      className,
    )}
    {...rest}
  >
    {children}
    {shortcut ? (
      <span className="ml-auto font-mono text-2xs text-muted-foreground">{shortcut}</span>
    ) : null}
  </RxContext.Item>
));
ContextMenuItem.displayName = 'ContextMenuItem';

export const ContextMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RxContext.Separator>,
  React.ComponentPropsWithoutRef<typeof RxContext.Separator>
>(({ className, ...rest }, ref) => (
  <RxContext.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...rest}
  />
));
ContextMenuSeparator.displayName = 'ContextMenuSeparator';

export const ContextMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RxContext.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RxContext.CheckboxItem>
>(({ className, children, checked, ...rest }, ref) => (
  <RxContext.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none focus:bg-muted',
      className,
    )}
    {...rest}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <RxContext.ItemIndicator>
        <Check className="size-3.5" aria-hidden />
      </RxContext.ItemIndicator>
    </span>
    {children}
  </RxContext.CheckboxItem>
));
ContextMenuCheckboxItem.displayName = 'ContextMenuCheckboxItem';
