// SPDX-License-Identifier: BUSL-1.1
'use client';

import * as React from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ShieldCheck, ClipboardCheck } from 'lucide-react';
import { Alert, Badge, Button, Skeleton, Textarea, Label, FieldHint } from '@auditforge/ui-kit';
import { useFinding } from '@/lib/hooks/use-findings';
import { usePromoteFinding, useRecordCapa } from '@/lib/hooks/use-mutations';
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

export default function FindingDetailPage({ params }: { params: Promise<{ findingId: string }> }) {
  const { findingId } = use(params);
  const { data, isLoading, error } = useFinding(findingId);
  const promote = usePromoteFinding(findingId);
  const capa = useRecordCapa(findingId);
  const [capaText, setCapaText] = React.useState('');
  const [capaError, setCapaError] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <Link href="/findings" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Findings
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Finding not found'}
        </Alert>
      </div>
    );
  }

  const handleCapa = async () => {
    setCapaError(null);
    if (capaText.trim().length < 5) {
      setCapaError('Provide at least a brief CAPA summary.');
      return;
    }
    await capa.mutateAsync({ capaSummary: capaText });
    setCapaText('');
  };

  const isPromoted = data.severity !== 'ofi' && (data.status === 'capa_pending' || data.status === 'capa_in_progress' || data.status === 'closed' || data.status === 'verified');

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/findings" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Findings
      </Link>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <h1 className="text-2xl font-semibold">{data.title}</h1>
        <Badge tone={SEVERITY_TONE[data.severity]}>{SEVERITY_LABEL[data.severity]}</Badge>
      </div>

      <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Status</dt>
          <dd className="mt-1 capitalize">{data.status.replace(/_/g, ' ')}</dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Control reference</dt>
          <dd className="mt-1 font-mono text-xs">{data.controlRef}</dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Engagement</dt>
          <dd className="mt-1">
            <Link href={`/engagements/${data.engagementId}`} className="hover:underline font-mono text-xs">{data.engagementId}</Link>
          </dd>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">Evidence count</dt>
          <dd className="mt-1 tabular-nums">{data.evidence.length}</dd>
        </div>
      </dl>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Description</h2>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{data.description}</p>
      </section>

      {data.evidence.length > 0 && (
        <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Evidence</h2>
          <ul className="space-y-1 text-xs font-mono">
            {data.evidence.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium">Promote to formal finding</h3>
            <p className="text-xs text-slate-500 mt-1 mb-2">
              Confirm the candidate has been peer-reviewed and is ready to appear in the report.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              iconLeft={<ShieldCheck />}
              loading={promote.isPending}
              disabled={isPromoted || data.status === 'verified'}
              onClick={() => promote.mutate()}
            >
              {isPromoted ? 'Already promoted' : 'Promote'}
            </Button>
          </div>
          <div>
            <h3 className="text-sm font-medium">Record CAPA</h3>
            <Label htmlFor="capa-summary">CAPA summary</Label>
            <Textarea
              id="capa-summary"
              rows={3}
              value={capaText}
              onChange={(e) => setCapaText(e.target.value)}
              placeholder="Describe the corrective + preventive action and verification method."
            />
            {capaError ? <FieldHint tone="error">{capaError}</FieldHint> : null}
            <Button
              type="button"
              variant="success"
              size="sm"
              className="mt-2"
              iconLeft={<ClipboardCheck />}
              loading={capa.isPending}
              onClick={handleCapa}
              disabled={data.status === 'closed' || data.status === 'verified'}
            >
              Record CAPA
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
