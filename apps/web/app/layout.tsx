// SPDX-License-Identifier: BUSL-1.1
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/providers/query-provider';
import { Toaster } from 'sonner';
import { getNonce } from '@/lib/nonce';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuditForge ISO 42001',
  description: 'Workbench for ISO/IEC 42001 Lead Auditors',
  applicationName: 'AuditForge',
  robots: { index: false, follow: false },
  manifest: '/manifest.webmanifest',
  themeColor: '#10b981',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AuditForge',
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Per-request CSP nonce supplied by apps/web/middleware.ts. Pass it down
  // to anything rendering inline <script>/<style> on the server so the tag
  // matches the per-request `'nonce-...'` source expression in the CSP.
  const nonce = await getNonce();

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider nonce={nonce}>
          {children}
          <Toaster position="top-right" closeButton richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
