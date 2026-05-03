// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as RxAvatar from '@radix-ui/react-avatar';
import * as React from 'react';

import { cn } from '../lib/cn';

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof RxAvatar.Root> {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  src?: string;
  alt?: string;
  /** Initials fallback. Auto-generated from `alt` when not provided. */
  initials?: string;
}

const sizes = {
  xs: 'size-5 text-[10px]',
  sm: 'size-7 text-xs',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
} as const;

export const Avatar = React.forwardRef<
  React.ElementRef<typeof RxAvatar.Root>,
  AvatarProps
>(({ className, size = 'md', src, alt, initials, ...rest }, ref) => {
  const fallback = initials ?? deriveInitials(alt ?? '');
  return (
    <RxAvatar.Root
      ref={ref}
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-foreground/80',
        'border border-border',
        sizes[size],
        className,
      )}
      {...rest}
    >
      {src ? (
        <RxAvatar.Image
          src={src}
          alt={alt ?? ''}
          className="size-full object-cover"
        />
      ) : null}
      <RxAvatar.Fallback
        delayMs={400}
        className="flex size-full items-center justify-center font-medium"
      >
        {fallback || '·'}
      </RxAvatar.Fallback>
    </RxAvatar.Root>
  );
});
Avatar.displayName = 'Avatar';

function deriveInitials(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}
