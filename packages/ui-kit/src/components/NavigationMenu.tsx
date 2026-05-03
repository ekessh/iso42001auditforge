// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxNav from '@radix-ui/react-navigation-menu';
import * as React from 'react';

import { cn } from '../lib/cn';

export const NavigationMenu = React.forwardRef<
  React.ElementRef<typeof RxNav.Root>,
  React.ComponentPropsWithoutRef<typeof RxNav.Root>
>(({ className, children, ...rest }, ref) => (
  <RxNav.Root ref={ref} className={cn('relative', className)} {...rest}>
    {children}
  </RxNav.Root>
));
NavigationMenu.displayName = 'NavigationMenu';

export const NavigationMenuList = React.forwardRef<
  React.ElementRef<typeof RxNav.List>,
  React.ComponentPropsWithoutRef<typeof RxNav.List>
>(({ className, ...rest }, ref) => (
  <RxNav.List ref={ref} className={cn('flex items-center gap-1', className)} {...rest} />
));
NavigationMenuList.displayName = 'NavigationMenuList';

export const NavigationMenuItem = RxNav.Item;
export const NavigationMenuLink = RxNav.Link;
