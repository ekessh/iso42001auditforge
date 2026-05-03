// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxCheckbox from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof RxCheckbox.Root>,
  React.ComponentPropsWithoutRef<typeof RxCheckbox.Root>
>(({ className, ...rest }, ref) => (
  <RxCheckbox.Root
    ref={ref}
    className={cn(
      'peer size-4 shrink-0 rounded border border-input bg-card',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:border-primary',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'transition-colors',
      className,
    )}
    {...rest}
  >
    <RxCheckbox.Indicator className="flex items-center justify-center">
      {(rest as { checked?: boolean | 'indeterminate' }).checked === 'indeterminate' ? (
        <Minus className="size-3" aria-hidden />
      ) : (
        <Check className="size-3" aria-hidden />
      )}
    </RxCheckbox.Indicator>
  </RxCheckbox.Root>
));
Checkbox.displayName = 'Checkbox';
