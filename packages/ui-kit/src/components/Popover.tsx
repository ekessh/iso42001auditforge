// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxPopover from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Popover = RxPopover.Root;
export const PopoverTrigger = RxPopover.Trigger;
export const PopoverAnchor = RxPopover.Anchor;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof RxPopover.Content>,
  React.ComponentPropsWithoutRef<typeof RxPopover.Content>
>(({ className, align = 'center', sideOffset = 6, ...rest }, ref) => (
  <RxPopover.Portal>
    <RxPopover.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      style={{ zIndex: 60 }}
      className={cn(
        'w-72 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-md outline-none',
        'data-[state=open]:animate-fade-in',
        className,
      )}
      {...rest}
    />
  </RxPopover.Portal>
));
PopoverContent.displayName = 'PopoverContent';
