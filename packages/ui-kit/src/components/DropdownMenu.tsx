// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxDropdown from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const DropdownMenu = RxDropdown.Root;
export const DropdownMenuTrigger = RxDropdown.Trigger;
export const DropdownMenuGroup = RxDropdown.Group;
export const DropdownMenuPortal = RxDropdown.Portal;
export const DropdownMenuSub = RxDropdown.Sub;
export const DropdownMenuRadioGroup = RxDropdown.RadioGroup;

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof RxDropdown.Content>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.Content>
>(({ className, sideOffset = 6, ...rest }, ref) => (
  <RxDropdown.Portal>
    <RxDropdown.Content
      ref={ref}
      sideOffset={sideOffset}
      style={{ zIndex: 60 }}
      className={cn(
        'min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...rest}
    />
  </RxDropdown.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof RxDropdown.Item>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.Item> & {
    shortcut?: string;
    danger?: boolean;
  }
>(({ className, children, shortcut, danger, ...rest }, ref) => (
  <RxDropdown.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-muted data-[highlighted]:bg-muted',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      danger && 'text-destructive focus:bg-destructive/10 data-[highlighted]:bg-destructive/10',
      '[&_svg]:size-4 [&_svg]:shrink-0',
      className,
    )}
    {...rest}
  >
    {children}
    {shortcut ? (
      <span className="ml-auto font-mono text-2xs text-muted-foreground">{shortcut}</span>
    ) : null}
  </RxDropdown.Item>
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof RxDropdown.Label>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.Label>
>(({ className, ...rest }, ref) => (
  <RxDropdown.Label
    ref={ref}
    className={cn('px-2 py-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground', className)}
    {...rest}
  />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof RxDropdown.Separator>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.Separator>
>(({ className, ...rest }, ref) => (
  <RxDropdown.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...rest}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

export const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof RxDropdown.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.CheckboxItem>
>(({ className, children, checked, ...rest }, ref) => (
  <RxDropdown.CheckboxItem
    ref={ref}
    {...(checked !== undefined ? { checked } : {})}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none',
      'focus:bg-muted data-[highlighted]:bg-muted',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...rest}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <RxDropdown.ItemIndicator>
        <Check className="size-3.5" aria-hidden />
      </RxDropdown.ItemIndicator>
    </span>
    {children}
  </RxDropdown.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = 'DropdownMenuCheckboxItem';

export const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof RxDropdown.RadioItem>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.RadioItem>
>(({ className, children, ...rest }, ref) => (
  <RxDropdown.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none focus:bg-muted',
      className,
    )}
    {...rest}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <RxDropdown.ItemIndicator>
        <Circle className="size-2 fill-current" aria-hidden />
      </RxDropdown.ItemIndicator>
    </span>
    {children}
  </RxDropdown.RadioItem>
));
DropdownMenuRadioItem.displayName = 'DropdownMenuRadioItem';

export const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof RxDropdown.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.SubTrigger>
>(({ className, children, ...rest }, ref) => (
  <RxDropdown.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none',
      'focus:bg-muted data-[state=open]:bg-muted',
      className,
    )}
    {...rest}
  >
    {children}
    <ChevronRight className="ml-auto size-3.5" aria-hidden />
  </RxDropdown.SubTrigger>
));
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

export const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof RxDropdown.SubContent>,
  React.ComponentPropsWithoutRef<typeof RxDropdown.SubContent>
>(({ className, ...rest }, ref) => (
  <RxDropdown.SubContent
    ref={ref}
    style={{ zIndex: 60 }}
    className={cn(
      'min-w-[10rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-sm shadow-md',
      'data-[state=open]:animate-fade-in',
      className,
    )}
    {...rest}
  />
));
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';
