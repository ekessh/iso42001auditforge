// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Alert, Button, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { ChecklistRow } from '@/components/qa-checklist/checklist-row';
import {
  useEvaluateQaChecklist,
  useOverrideQaChecklistItem,
} from '@/lib/hooks/use-qa-checklist';

const SAMPLE_ENGAGEMENT = '00000000-0000-0000-0000-000000000001';
const SAMPLE_REPORT = '00000000-0000-0000-0000-000000000002';

export default function QaChecklistPage() {
  const evaluate = useEvaluateQaChecklist();
  const override = useOverrideQaChecklistItem();
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [rationale, setRationale] = useState('');

  const result = evaluate.data;
  const error = evaluate.error;

  const run = (mode: 'audit' | 'readiness') => {
    evaluate.mutate({
      engagementId: SAMPLE_ENGAGEMENT,
      mode,
      draft: {
        reportId: SAMPLE_REPORT,
        type: 'stage2',
        status: 'in_review',
        scopeStatement:
          'Audit covers all in-scope AI systems for the certification body’s scope of accreditation.',
        methodologyStatement:
          'ISO 17021-1 Stage 2 protocol with NIST AI RMF mapping and OWASP LLM Top 10 probe coverage.',
        hasMandatoryDisclaimer: mode === 'readiness',
      },
      findings: [],
      candidateFindings: [],
      peerReview: { required: true, status: 'approved', approvedAt: new Date().toISOString(), securityReviewRequired: false },
      samplingPlan: { planId: '00000000-0000-0000-0000-000000000003', documentedAt: new Date().toISOString() },
      impartiality: { declared: true, declaredAt: new Date().toISOString(), declaredBy: SAMPLE_ENGAGEMENT },
      signing: { signingKeyId: 'demo-key', tsaAnchorId: 'demo-tsa' },
      overrides: {},
    });
  };

  const submitOverride = () => {
    if (!overridingId || rationale.trim().length < 8) return;
    override.mutate({
      engagementId: SAMPLE_ENGAGEMENT,
      reportId: SAMPLE_REPORT,
      itemId: overridingId,
      rationale,
    });
    setOverridingId(null);
    setRationale('');
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">QA Checklist</h1>
        <p className="text-sm text-slate-500 mt-1">
          Pre-publication quality gate. Every check must pass (or be explicitly overridden by a
          lead auditor with rationale) before a signed report can be issued.
        </p>
      </header>

      <div className="flex gap-2 mb-6">
        <Button onClick={() => run('audit')} disabled={evaluate.isPending}>
          Run for current engagement (Audit)
        </Button>
        <Button variant="secondary" onClick={() => run('readiness')} disabled={evaluate.isPending}>
          Run (Readiness)
        </Button>
      </div>

      {error && (
        <Alert tone="danger" className="mb-4">
          {error instanceof Error ? error.message : 'Failed to evaluate checklist.'}
        </Alert>
      )}

      {evaluate.isPending && <Skeleton className="h-32 w-full" />}

      {!evaluate.isPending && !result && (
        <EmptyState
          icon={<ClipboardCheck />}
          title="No evaluation yet"
          description="Choose a mode above to run the pre-publication checklist."
        />
      )}

      {result && (
        <section aria-labelledby="qa-summary">
          <div className="mb-3 flex items-center gap-3">
            <h2 id="qa-summary" className="text-base font-medium">
              Result:
            </h2>
            <span className={result.passed ? 'text-success font-semibold' : 'text-destructive font-semibold'}>
              {result.passed ? 'PASS' : 'BLOCKED'}
            </span>
          </div>
          <ul className="space-y-2">
            {result.items.map((it) => (
              <ChecklistRow
                key={it.id}
                item={it}
                onOverride={(id) => setOverridingId(id)}
              />
            ))}
          </ul>
        </section>
      )}

      {overridingId && (
        <div
          role="dialog"
          aria-label="Override checklist item"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="bg-background rounded border border-slate-200 dark:border-slate-800 p-4 w-full max-w-md space-y-3">
            <h2 className="text-base font-medium">Override item: {overridingId}</h2>
            <p className="text-xs text-slate-500">
              Provide a defensible rationale (min 8 chars). This action is recorded in the audit
              ledger and visible to inspectors.
            </p>
            <textarea
              aria-label="Override rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="w-full rounded border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="e.g. Engagement is a witnessed audit; sampling plan documented externally."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOverridingId(null)}>
                Cancel
              </Button>
              <Button onClick={submitOverride} disabled={rationale.trim().length < 8}>
                Submit override
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
