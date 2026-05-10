// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { applyTheme, usePreferences } from '@/lib/store/preferences-store';

/** Mounts theme handling once: applies user pref + reacts to system changes. */
export function ThemeBootstrap() {
  const theme = usePreferences((s) => s.theme);

  React.useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return null;
}
