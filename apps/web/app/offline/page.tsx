// SPDX-License-Identifier: BUSL-1.1
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Offline · AuditForge',
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main
      role="main"
      aria-labelledby="offline-title"
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        backgroundColor: '#0b1120',
        color: '#e6edf3',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: '36rem', textAlign: 'center' }}>
        <h1
          id="offline-title"
          style={{ fontSize: '1.875rem', fontWeight: 600, marginBottom: '0.75rem' }}
        >
          You are offline
        </h1>
        <p style={{ fontSize: '1rem', lineHeight: 1.6, marginBottom: '1.5rem', color: '#94a3b8' }}>
          AuditForge is offline-first. Your unsaved working papers are stored locally and will
          sync when connectivity returns. Cached engagements remain available from the home
          screen.
        </p>
        <a
          href="/"
          style={{
            display: 'inline-block',
            minHeight: '44px',
            minWidth: '44px',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#10b981',
            color: '#0b1120',
            textDecoration: 'none',
            fontWeight: 600,
            borderRadius: '0.5rem',
          }}
        >
          Retry
        </a>
      </div>
    </main>
  );
}
