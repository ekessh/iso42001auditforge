// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Toaster as Sonner, toast as sonnerToast } from 'sonner';

export const Toaster = (props: React.ComponentProps<typeof Sonner>) => (
  <Sonner
    position="bottom-right"
    closeButton
    theme="system"
    toastOptions={{
      classNames: {
        toast:
          'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-md',
        description: 'group-[.toast]:text-muted-foreground',
        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        success: 'group-[.toaster]:border-success/30',
        error: 'group-[.toaster]:border-destructive/30',
        warning: 'group-[.toaster]:border-warning/40',
      },
    }}
    {...props}
  />
);

export { sonnerToast as toast };
