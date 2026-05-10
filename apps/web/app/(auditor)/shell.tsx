// SPDX-License-Identifier: BUSL-1.1
'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, AlertTriangle,
  Beaker, Activity, BookOpen, Settings, Command as CommandIcon,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/store/auth-store';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/engagements', label: 'Engagements', icon: Calendar },
  { href: '/findings', label: 'Findings', icon: AlertTriangle },
  { href: '/probes', label: 'Probes', icon: Beaker },
  { href: '/traces', label: 'Traces', icon: Activity },
  { href: '/library', label: 'Library', icon: BookOpen },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AuditorShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const auditor = useAuth((s) => s.auditor);
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950">
      <aside className="w-60 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col" aria-label="Primary navigation">
        <div className="px-4 h-14 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold">AuditForge</span>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">
          <div className="font-medium text-slate-700 dark:text-slate-200">{auditor?.name ?? 'Not signed in'}</div>
          <div className="text-slate-500">{auditor?.firmName ?? ''}</div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center px-4 justify-between">
          <button className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100" aria-label="Open command palette">
            <CommandIcon className="w-3.5 h-3.5" />
            <span>Cmd</span>
            <span className="font-mono px-1 py-0.5 border border-slate-300 dark:border-slate-700 rounded">K</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
