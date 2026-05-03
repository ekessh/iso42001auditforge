// SPDX-License-Identifier: BUSL-1.1
'use client';

import { toast } from '../components/Toaster';

export interface ToastOptions {
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

/** Thin wrapper over Sonner so apps depend only on the design system. */
export function useToast() {
  return {
    toast: (title: string, options?: ToastOptions) => toast(title, options),
    success: (title: string, options?: ToastOptions) => toast.success(title, options),
    error: (title: string, options?: ToastOptions) => toast.error(title, options),
    warning: (title: string, options?: ToastOptions) => toast.warning(title, options),
    info: (title: string, options?: ToastOptions) => toast.info(title, options),
    loading: (title: string, options?: ToastOptions) => toast.loading(title, options),
    dismiss: (id?: string | number) => toast.dismiss(id),
  };
}
