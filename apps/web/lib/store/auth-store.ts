// SPDX-License-Identifier: BUSL-1.1
'use client';
import { create } from 'zustand';

export interface AuthState {
  authenticated: boolean;
  auditor: { id: string; name: string; role: string; firmName: string } | null;
  signIn: (auditor: AuthState['auditor']) => void;
  signOut: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  authenticated: false,
  auditor: null,
  signIn: (auditor) => set({ authenticated: !!auditor, auditor }),
  signOut: () => set({ authenticated: false, auditor: null }),
}));
