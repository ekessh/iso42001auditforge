// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxSwitch from '@radix-ui/react-switch';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Switch = React.forwardRef<
  React.ElementRef<typeof RxSwitch.Root>,
  React.ComponentPropsWithoutRef<typeof RxSwitch.Root>
>(({ className, ...rest }, ref) => (
  <RxSwitch.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent',
      'bg-muted transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'data-[state=checked]:bg-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...rest}
  >
    <RxSwitch.Thumb
      className={cn(
        'pointer-events-none block size-4 rounded-full bg-card shadow-sm ring-0 transition-transform',
        'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0.5',
      )}
    />
  </RxSwitch.Root>
));
Switch.displayName = 'Switch';
