// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxDialog from '@radix-ui/react-dialog';
import { Command as CmdK } from 'cmdk';
import { Search } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Command = React.forwardRef<
  React.ElementRef<typeof CmdK>,
  React.ComponentPropsWithoutRef<typeof CmdK>
>(({ className, ...rest }, ref) => (
  <CmdK
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground',
      className,
    )}
    loop
    {...rest}
  />
));
Command.displayName = 'Command';

/** Modal-style command palette (Cmd+K). */
export const CommandDialog = ({
  open,
  onOpenChange,
  children,
  label = 'Command palette',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  label?: string;
}) => (
  <RxDialog.Root open={open} onOpenChange={onOpenChange}>
    <RxDialog.Portal>
      <RxDialog.Overlay
        className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm data-[state=open]:animate-fade-in"
        style={{ zIndex: 90 }}
      />
      <RxDialog.Content
        aria-label={label}
        style={{ zIndex: 90 }}
        className="fixed left-1/2 top-[15vh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl data-[state=open]:animate-slide-up focus:outline-none"
      >
        <RxDialog.Title className="sr-only">{label}</RxDialog.Title>
        <RxDialog.Description className="sr-only">
          Search clients, engagements, working papers, clauses and probes. Use arrow keys to navigate.
        </RxDialog.Description>
        <Command>{children}</Command>
      </RxDialog.Content>
    </RxDialog.Portal>
  </RxDialog.Root>
);

export const CommandInput = React.forwardRef<
  React.ElementRef<typeof CmdK.Input>,
  React.ComponentPropsWithoutRef<typeof CmdK.Input>
>(({ className, ...rest }, ref) => (
  <div className="flex items-center gap-2 border-b border-border px-3" cmdk-input-wrapper="">
    <Search className="size-4 opacity-60" aria-hidden />
    <CmdK.Input
      ref={ref}
      className={cn(
        'flex h-12 w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground',
        'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  </div>
));
CommandInput.displayName = 'CommandInput';

export const CommandList = React.forwardRef<
  React.ElementRef<typeof CmdK.List>,
  React.ComponentPropsWithoutRef<typeof CmdK.List>
>(({ className, ...rest }, ref) => (
  <CmdK.List
    ref={ref}
    className={cn('max-h-[60vh] overflow-y-auto overflow-x-hidden p-1.5', className)}
    {...rest}
  />
));
CommandList.displayName = 'CommandList';

export const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CmdK.Empty>,
  React.ComponentPropsWithoutRef<typeof CmdK.Empty>
>(({ className, ...rest }, ref) => (
  <CmdK.Empty
    ref={ref}
    className={cn('py-6 text-center text-xs text-muted-foreground', className)}
    {...rest}
  />
));
CommandEmpty.displayName = 'CommandEmpty';

export const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CmdK.Group>,
  React.ComponentPropsWithoutRef<typeof CmdK.Group>
>(({ className, ...rest }, ref) => (
  <CmdK.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-foreground',
      '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground',
      className,
    )}
    {...rest}
  />
));
CommandGroup.displayName = 'CommandGroup';

export const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CmdK.Separator>,
  React.ComponentPropsWithoutRef<typeof CmdK.Separator>
>(({ className, ...rest }, ref) => (
  <CmdK.Separator
    ref={ref}
    className={cn('mx-1 h-px bg-border', className)}
    {...rest}
  />
));
CommandSeparator.displayName = 'CommandSeparator';

export const CommandItem = React.forwardRef<
  React.ElementRef<typeof CmdK.Item>,
  React.ComponentPropsWithoutRef<typeof CmdK.Item> & {
    shortcut?: string;
  }
>(({ className, children, shortcut, ...rest }, ref) => (
  <CmdK.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-2 text-sm outline-none',
      'aria-selected:bg-muted data-[selected=true]:bg-muted',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      '[&_svg]:size-4 [&_svg]:shrink-0',
      className,
    )}
    {...rest}
  >
    {children}
    {shortcut ? (
      <span className="ml-auto font-mono text-2xs text-muted-foreground">{shortcut}</span>
    ) : null}
  </CmdK.Item>
));
CommandItem.displayName = 'CommandItem';
