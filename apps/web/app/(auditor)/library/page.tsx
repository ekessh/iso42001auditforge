// SPDX-License-Identifier: BUSL-1.1
'use client';

import { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { Alert, Badge, EmptyState, Skeleton } from '@auditforge/ui-kit';
import { useLibrary } from '@/lib/hooks/use-library';
import type { LibraryEntryKind } from '@auditforge/api-client';

const KIND_LABELS: Record<LibraryEntryKind, string> = {
  iso42001_clause: 'ISO 42001',
  annex_a_control: 'Annex A',
  eu_ai_act_article: 'EU AI Act',
  nist_ai_rmf: 'NIST AI RMF',
  owasp_llm: 'OWASP LLM',
  mitre_atlas: 'MITRE ATLAS',
  avid: 'AVID',
  mit_air: 'MIT AIR',
  question: 'Question',
};

const KIND_OPTIONS: Array<{ value: LibraryEntryKind | ''; label: string }> = [
  { value: '', label: 'All sources' },
  { value: 'iso42001_clause', label: 'ISO 42001 clauses' },
  { value: 'annex_a_control', label: 'Annex A controls' },
  { value: 'eu_ai_act_article', label: 'EU AI Act articles' },
  { value: 'nist_ai_rmf', label: 'NIST AI RMF' },
  { value: 'owasp_llm', label: 'OWASP LLM Top 10' },
  { value: 'mitre_atlas', label: 'MITRE ATLAS' },
  { value: 'avid', label: 'AVID' },
  { value: 'mit_air', label: 'MIT AI Risk' },
  { value: 'question', label: 'Question library' },
];

export default function LibraryPage() {
  const [kind, setKind] = useState<LibraryEntryKind | ''>('');
  const [q, setQ] = useState('');

  const { data, isLoading, error } = useLibrary({
    limit: 100,
    ...(kind ? { kind } : {}),
    ...(q ? { q } : {}),
  });
  const items = data?.items ?? [];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold">Library</h1>
      <p className="text-sm text-slate-500 mt-1">
        ISO 42001 clauses, Annex A controls, EU AI Act articles, NIST AI RMF subcategories, OWASP LLM Top 10, MITRE ATLAS, AVID, MIT AIR.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search library</span>
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            placeholder="Search by ref or title…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label>
          <span className="sr-only">Filter by source</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as LibraryEntryKind | '')}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error instanceof Error ? error.message : 'Failed to load library'}
        </Alert>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-2" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          className="mt-6"
          icon={<BookOpen />}
          title="No library entries"
          description="Library content is loaded from the catalogues package; ensure the API is wired."
        />
      ) : (
        <ul className="mt-6 space-y-2">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3"
            >
              <div className="flex items-start gap-3">
                <Badge tone="info" className="shrink-0">{KIND_LABELS[entry.kind]}</Badge>
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    <span className="font-mono text-xs text-slate-500 mr-2">{entry.ref}</span>
                    {entry.title}
                  </div>
                  {entry.body && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{entry.body}</p>
                  )}
                  {entry.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.tags.map((tag) => (
                        <span key={tag} className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
