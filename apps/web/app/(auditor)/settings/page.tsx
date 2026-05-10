// SPDX-License-Identifier: BUSL-1.1
'use client';

import { Button } from '@auditforge/ui-kit';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { auth as authApi } from '@auditforge/api-client';
import { useAuth } from '@/lib/store/auth-store';

export default function SettingsPage() {
  const router = useRouter();
  const auditor = useAuth((s) => s.auditor);
  const signOut = useAuth((s) => s.signOut);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: even if the API logout fails, clear local state.
    }
    signOut();
    router.push('/login');
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="text-sm text-slate-500 mt-1">
        Firm profile, auditor competence, NC numbering schemes, signing keys, telemetry consent.
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
