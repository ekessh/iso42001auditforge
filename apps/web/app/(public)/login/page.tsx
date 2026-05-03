// SPDX-License-Identifier: BUSL-1.1
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/store/auth-store';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const signIn = useAuth((s) => s.signIn);
  const [busy, setBusy] = useState(false);

  const handlePasskey = async () => {
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      signIn({ id: 'auditor-001', name: 'M. Castellanos', role: 'lead_auditor', firmName: 'Sentinel CB' });
      toast.success('Signed in via passkey');
      router.push('/dashboard');
    } catch {
      toast.error('Passkey authentication failed');
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
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Use your hardware-backed passkey.</p>
          </div>
          <button
            onClick={handlePasskey}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 transition disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Continue with passkey
          </button>
          <div className="text-center text-xs text-slate-400">
            Or use OIDC SSO &middot; PKCS#11 smart card
          </div>
          <div className="text-xs text-slate-500 text-center">
            By signing in you accept the auditor terms and confirm impartiality
            disclosures for active engagements.
          </div>
        </div>
      </main>
    </div>
  );
}
