// SPDX-License-Identifier: BUSL-1.1
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemePref = 'light' | 'dark' | 'system';
export type DefaultMode = 'audit' | 'readiness';

export interface PreferencesState {
  theme: ThemePref;
  density: 'compact' | 'comfortable';
  defaultMode: DefaultMode;
  setTheme: (t: ThemePref) => void;
  setDensity: (d: 'compact' | 'comfortable') => void;
  setDefaultMode: (m: DefaultMode) => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      density: 'comfortable',
      defaultMode: 'audit',
      setTheme: (theme) => set({ theme }),
      setDensity: (density) => set({ density }),
      setDefaultMode: (defaultMode) => set({ defaultMode }),
    }),
    {
      name: 'auditforge.preferences',
      storage: createJSONStorage(() => (typeof window === 'undefined' ? noopStorage : window.localStorage)),
    },
  ),
);

/** Apply theme class to <html>. Idempotent. */
export function applyTheme(theme: ThemePref) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);
  root.dataset.theme = isDark ? 'dark' : 'light';
}
