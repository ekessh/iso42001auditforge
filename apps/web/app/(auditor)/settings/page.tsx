// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { Button, Label } from '@auditforge/ui-kit';
import { LogOut, Sun, Moon, Monitor } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth as authApi } from '@auditforge/api-client';
import { useAuth } from '@/lib/store/auth-store';
import { usePreferences, type ThemePref, type DefaultMode } from '@/lib/store/preferences-store';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const auditor = useAuth((s) => s.auditor);
  const signOut = useAuth((s) => s.signOut);
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const density = usePreferences((s) => s.density);
  const setDensity = usePreferences((s) => s.setDensity);
  const defaultMode = usePreferences((s) => s.defaultMode);
  const setDefaultMode = usePreferences((s) => s.setDefaultMode);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best effort: clear local state regardless.
    }
    signOut();
    toast.success('Signed out');
    router.push('/login');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-slate-500 mt-1">
        Auditor profile, appearance preferences, default mode, and session.
      </p>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed-in auditor</h2>
        {auditor ? (
          <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="font-medium">{auditor.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Role</dt>
              <dd className="font-medium capitalize">{auditor.role.replace(/_/g, ' ')}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Firm</dt>
              <dd className="font-medium">{auditor.firmName || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Auditor ID</dt>
              <dd className="font-mono text-xs">{auditor.id}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Not signed in.</p>
        )}
      </section>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Appearance</h2>
        <div className="mt-3">
          <Label>Theme</Label>
          <div role="radiogroup" aria-label="Theme" className="mt-1 inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
            {([
              { value: 'light' as const, label: 'Light', icon: Sun },
              { value: 'system' as const, label: 'System', icon: Monitor },
              { value: 'dark' as const, label: 'Dark', icon: Moon },
            ]).map((opt) => {
              const active = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(opt.value as ThemePref)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <opt.icon className="size-3.5" aria-hidden /> {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4">
          <Label>Density</Label>
          <div role="radiogroup" aria-label="Density" className="mt-1 inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
            {(['comfortable', 'compact'] as const).map((d) => {
              const active = density === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDensity(d)}
                  className={`px-3 py-1.5 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Defaults</h2>
        <div className="mt-3">
          <Label>Default engagement mode</Label>
          <div role="radiogroup" aria-label="Default mode" className="mt-1 inline-flex rounded-md border border-slate-300 dark:border-slate-700 overflow-hidden">
            {(['audit', 'readiness'] as const).map((m) => {
              const active = defaultMode === m;
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDefaultMode(m as DefaultMode)}
                  className={`px-3 py-1.5 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleLogout} variant="outline" size="sm">
            <LogOut className="size-3.5" aria-hidden /> Sign out
          </Button>
        </div>
      </section>
    </div>
  );
}
