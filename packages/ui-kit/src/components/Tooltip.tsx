// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxTooltip from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '../lib/cn';

export const TooltipProvider = RxTooltip.Provider;
export const TooltipRoot = RxTooltip.Root;
export const TooltipTrigger = RxTooltip.Trigger;

export const TooltipContent = React.forwardRef<
  React.ElementRef<typeof RxTooltip.Content>,
  React.ComponentPropsWithoutRef<typeof RxTooltip.Content>
>(({ className, sideOffset = 6, ...rest }, ref) => (
  <RxTooltip.Portal>
    <RxTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-tooltip pointer-events-none rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md',
        'data-[state=delayed-open]:animate-fade-in data-[state=closed]:opacity-0',
        className,
      )}
      style={{ zIndex: 70 }}
      {...rest}
    />
  </RxTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

/**
 * Convenience wrapper: <Tooltip label="…">{trigger}</Tooltip>
 */
export const Tooltip = ({
  children,
  label,
  side = 'top',
  delayDuration = 250,
}: {
  children: React.ReactNode;
  label: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delayDuration?: number;
}) => (
  <TooltipProvider delayDuration={delayDuration}>
    <TooltipRoot>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </TooltipRoot>
  </TooltipProvider>
);
