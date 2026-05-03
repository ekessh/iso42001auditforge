// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxScrollArea from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { cn } from '../lib/cn';

export const ScrollArea = React.forwardRef<
  React.ElementRef<typeof RxScrollArea.Root>,
  React.ComponentPropsWithoutRef<typeof RxScrollArea.Root>
>(({ className, children, ...rest }, ref) => (
  <RxScrollArea.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...rest}
  >
    <RxScrollArea.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </RxScrollArea.Viewport>
    <ScrollBar />
    <RxScrollArea.Corner />
  </RxScrollArea.Root>
));
ScrollArea.displayName = 'ScrollArea';

export const ScrollBar = React.forwardRef<
  React.ElementRef<typeof RxScrollArea.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof RxScrollArea.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...rest }, ref) => (
  <RxScrollArea.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2 flex-col border-t border-t-transparent p-[1px]',
      className,
    )}
    {...rest}
  >
    <RxScrollArea.ScrollAreaThumb className="relative flex-1 rounded-full bg-border" />
  </RxScrollArea.ScrollAreaScrollbar>
));
ScrollBar.displayName = 'ScrollBar';
