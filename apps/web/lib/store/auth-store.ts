// SPDX-License-Identifier: BUSL-1.1
'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface AuditorSession {
  id: string;
  name: string;
  role: string;
  firmName: string;
}

export interface AuthState {
  authenticated: boolean;
  auditor: AuditorSession | null;
  signIn: (auditor: AuditorSession) => void;
  signOut: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      authenticated: false,
      auditor: null,
      signIn: (auditor) => set({ authenticated: !!auditor, auditor }),
      signOut: () => set({ authenticated: false, auditor: null }),
    }),
    {
      name: 'auditforge.auth',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      partialize: (state) => ({
        authenticated: state.authenticated,
        auditor: state.auditor,
      }),
    },
  ),
);
