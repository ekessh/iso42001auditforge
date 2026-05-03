// SPDX-License-Identifier: BUSL-1.1
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState, type ReactNode } from 'react';

/**
 * Per-request CSP nonce, forwarded from the Server Component layout. Client
 * Components that need to render inline `<script>` or `<style>` (rare —
 * almost never necessary inside React) can read this via `useNonce()` and
 * pass it through.
 *
 * `null` means "no nonce was injected" — preserves backwards compatibility
 * with code paths that were written before per-request nonces existed.
 */
const NonceContext = createContext<string | null>(null);

export function useNonce(): string | null {
  return useContext(NonceContext);
}

export interface QueryProviderProps {
  children: ReactNode;
  /**
   * Per-request CSP nonce sourced from `apps/web/lib/nonce.ts` in the
   * Server Component tree. Optional — when omitted, behaviour is identical
   * to the pre-nonce implementation.
   */
  nonce?: string;
}

export function QueryProvider({ children, nonce }: QueryProviderProps) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 2, refetchOnWindowFocus: false } },
  }));
  return (
    <NonceContext.Provider value={nonce ?? null}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NonceContext.Provider>
  );
}
