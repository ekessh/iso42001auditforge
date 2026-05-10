// SPDX-License-Identifier: BUSL-1.1
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  ApiNotFoundError,
  ApiUnauthorizedError,
  auth as authApi,
} from '@auditforge/api-client';
import { useAuth } from '@/lib/store/auth-store';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const STUB_MODE = process.env['NEXT_PUBLIC_AUTH_STUB'] === '1';

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState('');

  const completeStubLogin = async () => {
    await new Promise((r) => setTimeout(r, 800));
    signIn({
      id: 'auditor-001',
      name: 'M. Castellanos',
      role: 'lead_auditor',
      firmName: 'Sentinel CB',
    });
    toast.success('Signed in (stub mode)');
    router.push('/dashboard');
  };

  const completeWebauthnLogin = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error('Enter your auditor username to continue');
      return;
    }

    const startRaw = await authApi.webauthnLoginStart({ username: trimmed });

    let session;
    try {
      const assertion = await startAuthentication({
        optionsJSON: startRaw as unknown as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      session = await authApi.webauthnLoginFinish({
        username: trimmed,
        assertionResponse: assertion,
      });
    } catch (err) {
      if (err instanceof ApiNotFoundError) {
        toast.error('No passkey registered. Use registration first.');
        return;
      }
      throw err;
    }

    signIn({
      id: session.auditorId,
      name: session.name ?? trimmed,
      role: session.roles[0] ?? 'auditor',
      firmName: session.firmName ?? '',
    });
    toast.success('Signed in via passkey');
    router.push('/dashboard');
  };

  const handlePasskey = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (STUB_MODE) {
        await completeStubLogin();
        return;
      }
      await completeWebauthnLogin();
    } catch (err) {
      if (err instanceof ApiUnauthorizedError) {
        toast.error('Passkey rejected by server');
      } else {
        const message = err instanceof Error ? err.message : 'Passkey authentication failed';
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    if (busy) return;
    if (STUB_MODE) {
      toast.info('Stub mode: skipping passkey registration');
      return;
    }
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error('Enter your auditor username to register a passkey');
      return;
    }
    setBusy(true);
    try {
      const startRaw = await authApi.webauthnRegisterStart({ username: trimmed });
      const attestation = await startRegistration({
        optionsJSON: startRaw as unknown as Parameters<typeof startRegistration>[0]['optionsJSON'],
      });
      const session = await authApi.webauthnRegisterFinish({
        username: trimmed,
        attestationResponse: attestation,
      });
      signIn({
        id: session.auditorId,
        name: session.name ?? trimmed,
        role: session.roles[0] ?? 'auditor',
        firmName: session.firmName ?? '',
      });
      toast.success('Passkey registered');
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Passkey registration failed';
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-slate-950 text-slate-100 p-12">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-emerald-400" />
          <span className="font-semibold">AuditForge</span>
          <span className="text-xs text-slate-400 uppercase tracking-wider ml-2">ISO 42001</span>
        </div>
        <div>
          <h1 className="text-3xl font-semibold leading-tight">
            The workbench for AIMS lead auditors.
          </h1>
          <p className="mt-3 text-slate-300">
            Plan engagements, ingest agent traces, run technical probes, sign reports
            with a hardware-backed key, and freeze the audit file with TSA.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          BUSL-1.1 source available. Auditor independence preserved.
        </div>
      </aside>
      <main className="flex items-center justify-center p-8">
        <form
          className="w-full max-w-sm space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            handlePasskey();
          }}
        >
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">
              {STUB_MODE
                ? 'Stub auth is enabled (NEXT_PUBLIC_AUTH_STUB=1). Click below to continue.'
                : 'Use your hardware-backed passkey.'}
            </p>
          </div>
          {!STUB_MODE && (
            <label className="block">
              <span className="text-xs uppercase tracking-wide text-slate-500">Auditor username</span>
              <input
                type="text"
                inputMode="email"
                autoComplete="username webauthn"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="m.castellanos@sentinel.example"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-xs focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                aria-label="Auditor username"
              />
            </label>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <KeyRound className="w-4 h-4" aria-hidden />}
            Continue with passkey
          </button>
          {!STUB_MODE && (
            <button
              type="button"
              onClick={handleRegister}
              disabled={busy}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-50"
            >
              First time on this device? Register a passkey
            </button>
          )}
          <div className="text-center text-xs text-slate-400">
            Or use OIDC SSO &middot; PKCS#11 smart card
          </div>
          <div className="text-xs text-slate-500 text-center">
            By signing in you accept the auditor terms and confirm impartiality
            disclosures for active engagements.
          </div>
        </form>
      </main>
    </div>
  );
}
