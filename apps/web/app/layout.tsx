// SPDX-License-Identifier: BUSL-1.1
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { QueryProvider } from '@/lib/providers/query-provider';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'AuditForge ISO 42001',
  description: 'Workbench for ISO/IEC 42001 Lead Auditors',
  applicationName: 'AuditForge',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          {children}
          <Toaster position="top-right" closeButton richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
