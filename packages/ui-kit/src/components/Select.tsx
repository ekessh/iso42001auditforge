// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Select = RxSelect.Root;
export const SelectGroup = RxSelect.Group;
export const SelectValue = RxSelect.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RxSelect.Trigger>,
  React.ComponentPropsWithoutRef<typeof RxSelect.Trigger>
>(({ className, children, ...rest }, ref) => (
  <RxSelect.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-1.5 text-sm',
      'placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring',
      'disabled:cursor-not-allowed disabled:opacity-50',
      '[&>span]:line-clamp-1',
      className,
    )}
    {...rest}
  >
    {children}
    <RxSelect.Icon asChild>
      <ChevronDown className="size-4 opacity-60" aria-hidden />
    </RxSelect.Icon>
  </RxSelect.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RxSelect.Content>,
  React.ComponentPropsWithoutRef<typeof RxSelect.Content>
>(({ className, children, position = 'popper', ...rest }, ref) => (
  <RxSelect.Portal>
    <RxSelect.Content
      ref={ref}
      position={position}
      style={{ zIndex: 60 }}
      className={cn(
        'relative max-h-96 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md',
        'data-[state=open]:animate-fade-in',
        position === 'popper' && 'translate-y-1',
        className,
      )}
      {...rest}
    >
      <RxSelect.ScrollUpButton className="flex h-6 items-center justify-center">
        <ChevronUp className="size-4" aria-hidden />
      </RxSelect.ScrollUpButton>
      <RxSelect.Viewport className={cn('p-1', position === 'popper' && 'min-w-[var(--radix-select-trigger-width)]')}>
        {children}
      </RxSelect.Viewport>
      <RxSelect.ScrollDownButton className="flex h-6 items-center justify-center">
        <ChevronDown className="size-4" aria-hidden />
      </RxSelect.ScrollDownButton>
    </RxSelect.Content>
  </RxSelect.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof RxSelect.Label>,
  React.ComponentPropsWithoutRef<typeof RxSelect.Label>
>(({ className, ...rest }, ref) => (
  <RxSelect.Label
    ref={ref}
    className={cn('px-2 py-1 text-2xs font-medium uppercase tracking-wide text-muted-foreground', className)}
    {...rest}
  />
));
SelectLabel.displayName = 'SelectLabel';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RxSelect.Item>,
  React.ComponentPropsWithoutRef<typeof RxSelect.Item>
>(({ className, children, ...rest }, ref) => (
  <RxSelect.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-sm outline-none',
      'focus:bg-muted data-[highlighted]:bg-muted data-[highlighted]:text-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className,
    )}
    {...rest}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <RxSelect.ItemIndicator>
        <Check className="size-3.5" aria-hidden />
      </RxSelect.ItemIndicator>
    </span>
    <RxSelect.ItemText>{children}</RxSelect.ItemText>
  </RxSelect.Item>
));
SelectItem.displayName = 'SelectItem';

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof RxSelect.Separator>,
  React.ComponentPropsWithoutRef<typeof RxSelect.Separator>
>(({ className, ...rest }, ref) => (
  <RxSelect.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...rest}
  />
));
SelectSeparator.displayName = 'SelectSeparator';
