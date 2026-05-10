// SPDX-License-Identifier: BUSL-1.1
'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Alert, Badge, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useFindings } from '@/lib/hooks/use-findings';
import type { FindingSeverity } from '@auditforge/api-client';

const SEVERITY_TONE: Record<FindingSeverity, 'danger' | 'warning' | 'info' | 'success'> = {
  major_nc: 'danger',
  minor_nc: 'warning',
  ofi: 'info',
  conformity: 'success',
};

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  major_nc: 'Major NC',
  minor_nc: 'Minor NC',
  ofi: 'OFI',
  conformity: 'Conformity',
};

export default function FindingsPage() {
  const { data, isLoading, error } = useFindings({ limit: 100 });
  const items = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Findings</h1>
      <p className="text-sm text-slate-500 mt-1">Cross-engagement findings, NCs, and OFIs.</p>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load findings'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<AlertTriangle />}
          title="No findings raised"
          description="Findings raised across engagements will appear here once promoted from candidates."
        />
      ) : (
        <table className="mt-6 w-full text-sm" aria-label="Findings">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3">Title</th>
              <th className="py-2 pr-3">Severity</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Control</th>
              <th className="py-2 pr-3">Engagement</th>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                <td className="py-2 pr-3">
                  <Link
                    href={`/findings/${f.id}`}
                    className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {f.title}
                  </Link>
                  <div className="text-xs text-slate-500 line-clamp-1 max-w-2xl">{f.description}</div>
                </td>
                <td className="py-2 pr-3">
                  <Badge tone={SEVERITY_TONE[f.severity]}>{SEVERITY_LABEL[f.severity]}</Badge>
                </td>
                <td className="py-2 pr-3 capitalize">{f.status.replace(/_/g, ' ')}</td>
                <td className="py-2 pr-3 font-mono text-xs">{f.controlRef}</td>
                <td className="py-2 pr-3">
                  <Link
                    href={`/engagements/${f.engagementId}`}
                    className="text-xs text-slate-500 hover:underline"
                  >
                    {f.engagementId.slice(0, 8)}…
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
