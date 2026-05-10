// SPDX-License-Identifier: BUSL-1.1
'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  Skeleton,
} from '@auditforge/ui-kit';
import {
  AlertTriangle,
  Beaker,
  FileText,
  Plus,
  Pencil,
  Upload,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { useAuditTrail, useEngagement } from '@/lib/hooks/use-engagement';
import { useFindings } from '@/lib/hooks/use-findings';
import { useProbeExecutions } from '@/lib/hooks/use-probes';
import { useWorkingPapers } from '@/lib/hooks/use-working-papers';
import { useTraces } from '@/lib/hooks/use-traces';
import { EditPlanModal } from '@/components/modals/EditPlanModal';
import { RaiseNCModal } from '@/components/modals/RaiseNCModal';
import { RunProbeModal } from '@/components/modals/RunProbeModal';
import { NewWorkingPaperModal } from '@/components/modals/NewWorkingPaperModal';
import { UploadTraceModal } from '@/components/modals/UploadTraceModal';
import { useGenerateReportDraft } from '@/lib/hooks/use-mutations';
import type { FindingSeverity } from '@auditforge/api-client';

const TABS = ['Overview', 'Plan', 'Working Papers', 'Findings', 'Probes', 'Traces', 'Report', 'Audit Trail'] as const;
type Tab = (typeof TABS)[number];

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

export default function EngagementPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = use(params);
  const [active, setActive] = useState<Tab>('Overview');
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [raiseNcOpen, setRaiseNcOpen] = useState(false);
  const [runProbeOpen, setRunProbeOpen] = useState(false);
  const [newWpOpen, setNewWpOpen] = useState(false);
  const [uploadTraceOpen, setUploadTraceOpen] = useState(false);

  const engagementQ = useEngagement(engagementId);
  const findingsQ = useFindings({ engagementId, limit: 200 });
  const probesQ = useProbeExecutions(engagementId);
  const wpQ = useWorkingPapers({ engagementId, limit: 200 });
  const tracesQ = useTraces({ limit: 200 });
  const trailQ = useAuditTrail(active === 'Audit Trail' ? engagementId : '');
  const reportDraft = useGenerateReportDraft(engagementId);

  if (engagementQ.isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (engagementQ.error || !engagementQ.data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Link href="/engagements" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Engagements
        </Link>
        <Alert tone="danger" className="mt-4">
          {engagementQ.error instanceof Error ? engagementQ.error.message : 'Engagement not found'}
        </Alert>
      </div>
    );
  }

  const data = engagementQ.data;
  const findings = findingsQ.data?.items ?? [];
  const wps = wpQ.data?.items ?? [];
  const probes = probesQ.data?.items ?? [];
  const traces = (tracesQ.data?.items ?? []).filter((t) => (t.metadata as Record<string, unknown> | undefined)?.['engagementId'] === engagementId);

  const major = findings.filter((f) => f.severity === 'major_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const minor = findings.filter((f) => f.severity === 'minor_nc' && f.status !== 'closed' && f.status !== 'verified').length;
  const ofi = findings.filter((f) => f.severity === 'ofi' && f.status !== 'closed' && f.status !== 'verified').length;
  const wpComplete = wps.filter((w) => w.status === 'final').length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <Link href="/engagements" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Engagements
      </Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{data.clientId}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-3xl">{data.scopeStatement}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={data.mode === 'audit' ? 'info' : 'warning'}>{data.mode}</Badge>
          <Badge tone="neutral">{data.stage}</Badge>
          <Badge tone={data.status === 'in_progress' ? 'success' : 'neutral'}>{data.status.replace(/_/g, ' ')}</Badge>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Stage" value={data.stage} />
        <Stat label="Status" value={data.status.replace(/_/g, ' ')} />
        <Stat label="Mode" value={data.mode} />
        <Stat label="Ends" value={new Date(data.endsOn).toLocaleDateString()} />
      </div>

      <nav role="tablist" aria-label="Engagement tabs" className="mt-8 border-b border-slate-200 dark:border-slate-800 flex gap-4 text-sm overflow-x-auto">
        {TABS.map((t) => {
          const selected = t === active;
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(t)}
              className={`py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? 'border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
            >
              {t}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel" aria-label={active} aria-live="polite" className="mt-6">
        {active === 'Overview' && (
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card title="Open findings">
              <ul className="space-y-1 text-sm">
                <li className="flex justify-between"><span>Major NC</span><span className="text-red-600 tabular-nums font-medium">{major}</span></li>
                <li className="flex justify-between"><span>Minor NC</span><span className="text-amber-600 tabular-nums font-medium">{minor}</span></li>
                <li className="flex justify-between"><span>OFI</span><span className="text-slate-500 tabular-nums font-medium">{ofi}</span></li>
              </ul>
            </Card>
            <Card title="Working papers">
              <div className="text-3xl font-semibold tabular-nums">{wpComplete} / {wps.length}</div>
              <div className="text-xs text-slate-500 mt-1">Complete / Total</div>
            </Card>
            <Card title="Probes & Traces">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-3xl font-semibold tabular-nums">{probes.length}</div>
                  <div className="text-xs text-slate-500">Probe runs</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold tabular-nums">{traces.length}</div>
                  <div className="text-xs text-slate-500">Traces</div>
                </div>
              </div>
            </Card>
          </section>
        )}

        {active === 'Plan' && (
          <Card
            title="Audit plan"
            action={(
              <Button variant="outline" size="xs" onClick={() => setEditPlanOpen(true)} iconLeft={<Pencil />}>
                Edit plan
              </Button>
            )}
          >
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <Row label="Scope" value={data.scopeStatement} />
              <Row label="Mode" value={data.mode} />
              <Row label="Stage" value={data.stage} />
              <Row label="Status" value={data.status.replace(/_/g, ' ')} />
              <Row label="Starts" value={new Date(data.startsOn).toLocaleDateString()} />
              <Row label="Ends" value={new Date(data.endsOn).toLocaleDateString()} />
              <Row label="Lead auditor" value={data.leadAuditorId} />
              <Row label="Team" value={(data.teamMemberIds ?? []).join(', ') || '—'} />
            </dl>
          </Card>
        )}

        {active === 'Working Papers' && (
          <Card
            title={`Working papers (${wps.length})`}
            action={(
              <Button size="xs" iconLeft={<Plus />} onClick={() => setNewWpOpen(true)}>
                New WP
              </Button>
            )}
          >
            {wpQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
            ) : wps.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No working papers yet"
                description="Working papers document procedures performed against specific controls."
              />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {wps.map((w) => (
                  <li key={w.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/workspace/${engagementId}?wp=${w.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {w.title}
                      </Link>
                      <div className="text-xs text-slate-500 font-mono">{w.controlRef}</div>
                    </div>
                    <Badge tone={w.status === 'final' ? 'success' : w.status === 'in_review' ? 'warning' : 'neutral'}>
                      {w.status.replace(/_/g, ' ')}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {active === 'Findings' && (
          <Card
            title={`Findings (${findings.length})`}
            action={(
              <Button size="xs" iconLeft={<Plus />} onClick={() => setRaiseNcOpen(true)} variant="destructive">
                Raise NC
              </Button>
            )}
          >
            {findingsQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : findings.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle />}
                title="No findings for this engagement"
                description="Raise the first nonconformity, opportunity for improvement, or observation."
              />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {findings.map((f) => (
                  <li key={f.id} className="py-2.5 flex items-start gap-3">
                    <Badge tone={SEVERITY_TONE[f.severity]} className="mt-0.5 shrink-0">{SEVERITY_LABEL[f.severity]}</Badge>
                    <div className="min-w-0 flex-1">
                      <Link href={`/findings/${f.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{f.title}</Link>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">{f.controlRef}</span> &middot; {f.status.replace(/_/g, ' ')}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 max-w-3xl">{f.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {active === 'Probes' && (
          <Card
            title={`Probe runs (${probes.length})`}
            action={(
              <Button size="xs" iconLeft={<Plus />} onClick={() => setRunProbeOpen(true)}>
                Run probe
              </Button>
            )}
          >
            {probesQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : probes.length === 0 ? (
              <EmptyState
                icon={<Beaker />}
                title="No probes have been executed"
                description="Run the first probe — bias, robustness, prompt injection, hallucination, drift, or capability."
              />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {probes.map((p) => (
                  <li key={p.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium font-mono text-xs">{p.probeId ?? p.id}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(p.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs tabular-nums text-slate-500">${p.costUsd.toFixed(2)}</span>
                      <Badge tone={p.status === 'success' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>
                        {p.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {active === 'Traces' && (
          <Card
            title={`Traces (${traces.length})`}
            action={(
              <Button size="xs" iconLeft={<Upload />} onClick={() => setUploadTraceOpen(true)}>
                Upload trace
              </Button>
            )}
          >
            {tracesQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : traces.length === 0 ? (
              <EmptyState
                icon={<ScrollText />}
                title="No traces ingested for this engagement"
                description="Upload an agent trace (LangGraph, CrewAI, AutoGen, OTel)."
              />
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {traces.map((t) => (
                  <li key={t.id} className="py-2">
                    <Link href={`/traces/${t.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.name}</Link>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono">{t.id}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {active === 'Report' && (
          <Card
            title="Report draft"
            action={(
              <Button
                size="xs"
                iconLeft={<Sparkles />}
                onClick={() => reportDraft.mutate()}
                loading={reportDraft.isPending}
              >
                Generate draft
              </Button>
            )}
          >
            {reportDraft.error ? (
              <Alert tone="danger" className="mb-3">
                {reportDraft.error instanceof Error ? reportDraft.error.message : 'Could not generate draft'}
              </Alert>
            ) : null}
            {reportDraft.data ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-500">
                  Generated {new Date(reportDraft.data.generatedAt).toLocaleString()} &middot; status {reportDraft.data.status}
                </div>
                <CodeBlock language="json" className="max-h-96 overflow-auto" code={JSON.stringify(reportDraft.data, null, 2)} />
              </div>
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Draft generation pulls confirmed findings, working papers, evidence references, and the
                current scope into a structured JSON. The auditor reviews and signs the final report.
              </p>
            )}
          </Card>
        )}

        {active === 'Audit Trail' && (
          <Card title="Audit trail">
            {trailQ.isLoading ? (
              <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
            ) : trailQ.error ? (
              <Alert tone="warning">
                Audit ledger not available in this environment. The mock API does not yet
                serve <code className="font-mono">/v1/engagements/:id/audit-trail</code>.
                Production will render hash-chained, Ed25519-signed events.
              </Alert>
            ) : (trailQ.data?.items ?? []).length === 0 ? (
              <EmptyState
                icon={<ScrollText />}
                title="No ledger events yet"
                description="Every state transition emits a hash-chained event."
              />
            ) : (
              <ol className="space-y-2">
                {(trailQ.data?.items ?? []).map((e) => (
                  <li key={e.id} className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium font-mono text-xs">{e.kind}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{new Date(e.createdAt).toLocaleString()}{e.actor ? ` · ${e.actor}` : ''}</div>
                      </div>
                      {e.hashPrefix ? (
                        <span className="font-mono text-2xs text-slate-500" title="Hash chain prefix">{e.hashPrefix.slice(0, 12)}…</span>
                      ) : null}
                    </div>
                    {e.payload ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">payload</summary>
                        <pre className="mt-1 text-xs overflow-x-auto">{JSON.stringify(e.payload, null, 2)}</pre>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        )}
      </div>

      <EditPlanModal open={editPlanOpen} onOpenChange={setEditPlanOpen} engagement={data} />
      <RaiseNCModal open={raiseNcOpen} onOpenChange={setRaiseNcOpen} engagementId={engagementId} />
      <RunProbeModal open={runProbeOpen} onOpenChange={setRunProbeOpen} engagementId={engagementId} />
      <NewWorkingPaperModal open={newWpOpen} onOpenChange={setNewWpOpen} engagementId={engagementId} />
      <UploadTraceModal open={uploadTraceOpen} onOpenChange={setUploadTraceOpen} engagementId={engagementId} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-medium mt-0.5 break-words">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-xl font-semibold mt-1 tabular-nums capitalize">{value}</div>
    </div>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
