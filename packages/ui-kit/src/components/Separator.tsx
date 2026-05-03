// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxSeparator from '@radix-ui/react-separator';
import * as React from 'react';

import { cn } from '../lib/cn';

export const Separator = React.forwardRef<
  React.ElementRef<typeof RxSeparator.Root>,
  React.ComponentPropsWithoutRef<typeof RxSeparator.Root>
>(({ className, orientation = 'horizontal', decorative = true, ...rest }, ref) => (
  <RxSeparator.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'shrink-0 bg-border',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...rest}
  />
));
Separator.displayName = 'Separator';
