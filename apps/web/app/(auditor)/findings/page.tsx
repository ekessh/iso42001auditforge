// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Input, Skeleton } from '@auditforge/ui-kit';
import { useFindings } from '@/lib/hooks/use-findings';
import { useEngagements } from '@/lib/hooks/use-engagement';
import { RaiseNCModal } from '@/components/modals/RaiseNCModal';
import type { FindingSeverity, FindingStatus } from '@auditforge/api-client';

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

const STATUSES: FindingStatus[] = ['open', 'capa_pending', 'capa_in_progress', 'closed', 'verified'];

export default function FindingsPage() {
  const { data, isLoading, error } = useFindings({ limit: 200 });
  const engagementsQ = useEngagements({ limit: 200 });
  const [sev, setSev] = React.useState<FindingSeverity | ''>('');
  const [status, setStatus] = React.useState<FindingStatus | ''>('');
  const [eng, setEng] = React.useState<string>('');
  const [refQ, setRefQ] = React.useState('');
  const [raiseOpen, setRaiseOpen] = React.useState(false);

  const all = data?.items ?? [];
  const filtered = all.filter((f) => {
    if (sev && f.severity !== sev) return false;
    if (status && f.status !== status) return false;
    if (eng && f.engagementId !== eng) return false;
    if (refQ && !f.controlRef.toLowerCase().includes(refQ.toLowerCase())) return false;
    return true;
  });

  const sevs: Array<{ value: FindingSeverity; label: string }> = [
    { value: 'major_nc', label: 'Major NC' },
    { value: 'minor_nc', label: 'Minor NC' },
    { value: 'ofi', label: 'OFI' },
    { value: 'conformity', label: 'Conformity' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Findings</h1>
          <p className="text-sm text-slate-500 mt-1">Cross-engagement findings, NCs, and OFIs.</p>
        </div>
        <Button size="sm" variant="destructive" iconLeft={<Plus />} onClick={() => setRaiseOpen(true)}>Raise NC</Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2" aria-label="Filters">
        <Chip active={sev === ''} onClick={() => setSev('')}>All severities</Chip>
        {sevs.map((s) => (
          <Chip key={s.value} active={sev === s.value} onClick={() => setSev(s.value)}>{s.label}</Chip>
        ))}
        <span className="mx-1 h-5 w-px bg-slate-300 dark:bg-slate-700" aria-hidden />
        <Chip active={status === ''} onClick={() => setStatus('')}>All statuses</Chip>
        {STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>{s.replace(/_/g, ' ')}</Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-500">Engagement
          <select
            value={eng}
            onChange={(e) => setEng(e.target.value)}
            className="ml-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="">All</option>
            {(engagementsQ.data?.items ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.id}</option>
            ))}
          </select>
        </label>
        <Input
          iconLeft={<Search />}
          placeholder="Filter by control ref…"
          value={refQ}
          onChange={(e) => setRefQ(e.target.value)}
          className="max-w-xs"
        />
      </div>

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
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<AlertTriangle />}
          title={all.length === 0 ? 'No findings raised' : 'No findings match filters'}
          description={all.length === 0 ? 'Raise the first nonconformity using the button above.' : 'Try clearing the filters.'}
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
            {filtered.map((f) => (
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
                    {f.engagementId}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RaiseNCModal open={raiseOpen} onOpenChange={setRaiseOpen} />
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-full text-xs border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-500'}`}
    >
      {children}
    </button>
  );
}
