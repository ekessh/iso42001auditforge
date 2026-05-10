// SPDX-License-Identifier: BUSL-1.1
'use client';

import { use } from 'react';
import Link from 'next/link';
import { Alert, Skeleton } from '@auditforge/ui-kit';
import { useTrace } from '@/lib/hooks/use-traces';

interface Span {
  id?: string;
  name?: string;
  durationMs?: number;
  children?: Span[];
  [k: string]: unknown;
}

function extractSpans(metadata: unknown): Span[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const md = metadata as Record<string, unknown>;
  const candidate = md.spans ?? md.events ?? md.trace;
  if (Array.isArray(candidate)) return candidate as Span[];
  return [];
}

function SpanNode({ span, depth = 0 }: { span: Span; depth?: number }) {
  const children = Array.isArray(span.children) ? span.children : [];
  const summary = (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-xs">{span.name ?? span.id ?? 'span'}</span>
      {typeof span.durationMs === 'number' && (
        <span className="text-2xs text-slate-500 tabular-nums">{span.durationMs.toFixed(1)}ms</span>
      )}
    </span>
  );
  return (
    <details className="group" open={depth < 1}>
      <summary
        className="cursor-pointer rounded px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {summary}
      </summary>
      {children.length > 0 && (
        <div>
          {children.map((c, i) => (
            <SpanNode key={c.id ?? `${depth}-${i}`} span={c} depth={depth + 1} />
          ))}
        </div>
      )}
    </details>
  );
}

export default function TraceDetailPage({ params }: { params: Promise<{ traceId: string }> }) {
  const { traceId } = use(params);
  const { data, isLoading, error } = useTrace(traceId);

  if (isLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-3" aria-busy="true">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link href="/traces" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100">
          &larr; Traces
        </Link>
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Trace not found'}
        </Alert>
      </div>
    );
  }

  const spans = extractSpans(data.metadata);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/traces" className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        &larr; Traces
      </Link>
      <h1 className="text-2xl font-semibold mt-1">{data.name}</h1>
      <p className="text-xs text-slate-500 mt-1 font-mono">{data.id}</p>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Spans ({spans.length})</h2>
        {spans.length === 0 ? (
          <p className="text-sm text-slate-500">No span data found in trace metadata.</p>
        ) : (
          <div>
            {spans.map((s, i) => (
              <SpanNode key={s.id ?? `root-${i}`} span={s} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Raw metadata</h2>
        <details>
          <summary className="cursor-pointer text-xs text-slate-500">Show JSON</summary>
          <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">{JSON.stringify(data.metadata ?? {}, null, 2)}</pre>
        </details>
      </section>
    </div>
  );
}
