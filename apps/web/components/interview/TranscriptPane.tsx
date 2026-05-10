// SPDX-License-Identifier: BUSL-1.1
'use client';

import type { LiveTranscriptSegment } from '@/lib/hooks/use-live-interview';

interface Props {
  segments: LiveTranscriptSegment[];
  onMarkCandidate?: (segmentId: string) => void;
}

export function TranscriptPane({ segments, onMarkCandidate }: Props) {
  return (
    <section
      className="flex h-full min-h-0 flex-col rounded-md border border-border bg-background"
      aria-label="Live transcript"
    >
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Transcript</h2>
        <span className="text-xs text-muted-foreground">{segments.length} segments</span>
      </header>
      <div
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 space-y-2 overflow-y-auto p-3 font-sans text-sm leading-relaxed"
      >
        {segments.length === 0 ? (
          <p className="text-muted-foreground">Waiting for the first segment…</p>
        ) : null}
        {segments.map((s) => (
          <article
            key={s.id}
            data-segment-id={s.id}
            className="group rounded-sm border border-transparent px-2 py-1 hover:bg-muted/40 focus-within:border-border"
          >
            <div className="flex items-baseline gap-2">
              <span
                className="text-xs font-mono uppercase tracking-wide text-muted-foreground"
                aria-label={`speaker ${s.speakerId}`}
              >
                {s.speakerId}
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(s.startMs / 1000)}s
              </span>
              <span className="text-xs text-muted-foreground">
                conf {s.confidence.toFixed(2)}
              </span>
              {s.attached && s.attached.length > 0 ? (
                <span
                  className="text-xs rounded-sm bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700"
                  aria-label="attached clauses"
                >
                  {s.attached.map((a) => a.clauseId).join(', ')}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5">{s.text}</p>
            {onMarkCandidate ? (
              <button
                type="button"
                onClick={() => onMarkCandidate(s.id)}
                className="mt-1 text-xs text-blue-600 underline opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Mark as candidate finding"
              >
                Mark candidate finding
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
