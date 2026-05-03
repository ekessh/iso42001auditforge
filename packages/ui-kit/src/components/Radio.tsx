// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxRadio from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RxRadio.Root>,
  React.ComponentPropsWithoutRef<typeof RxRadio.Root>
>(({ className, ...rest }, ref) => (
  <RxRadio.Root ref={ref} className={cn('grid gap-2', className)} {...rest} />
));
RadioGroup.displayName = 'RadioGroup';

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RxRadio.Item>,
  React.ComponentPropsWithoutRef<typeof RxRadio.Item>
>(({ className, ...rest }, ref) => (
  <RxRadio.Item
    ref={ref}
    className={cn(
      'aspect-square size-4 rounded-full border border-input text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:border-primary',
      className,
    )}
    {...rest}
  >
    <RxRadio.Indicator className="flex items-center justify-center">
      <Circle className="size-2 fill-primary text-primary" aria-hidden />
    </RxRadio.Indicator>
  </RxRadio.Item>
));
RadioGroupItem.displayName = 'RadioGroupItem';
