// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ClaimsTab — rolling list of attribution-extracted claims for the right
 * pane. Per v3 §15.11, this is "useful for auditor review during breaks."
 *
 * Each row shows speaker, timestamp, claim text, attached clause ids, and
 * confidence indicator (Low/Medium/High dot, not numeric).
 */

import * as React from 'react';

import type { ClaimEntry, Confidence } from '@/lib/mocks/workspace-mock';

const CONFIDENCE_TONE: Record<Confidence, string> = {
  high: 'bg-success',
  medium: 'bg-warning',
  low: 'bg-muted-foreground',
};

export interface ClaimsTabProps {
  claims: ClaimEntry[];
  onClaimSelect?: (claimId: string) => void;
}

export function ClaimsTab({ claims, onClaimSelect }: ClaimsTabProps) {
  if (claims.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-center text-2xs text-muted-foreground">
        No claims extracted yet. Claims appear after each auditee answer is
        processed by the attribution pipeline.
      </p>
    );
  }
  return (
    <ol className="space-y-2" aria-label="Extracted claims">
      {claims.map((c) => (
        <li
          key={c.id}
          className="rounded-md border border-border bg-card p-2.5 shadow-xs hover:border-ring/40"
        >
          <button
            type="button"
            onClick={() => onClaimSelect?.(c.id)}
            className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            aria-label={`Claim ${c.id} by ${c.speakerName} at ${c.ts}`}
          >
            <header className="flex items-center justify-between gap-2 text-2xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${CONFIDENCE_TONE[c.confidence]}`}
                />
                <span className="font-medium text-foreground">{c.speakerName}</span>
                <span aria-hidden>·</span>
                <time>{c.ts}</time>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">{c.id}</span>
            </header>
            <p className="mt-1 text-xs leading-relaxed text-foreground">{c.body}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1">
              {c.clauseIds.map((cl) => (
                <li
                  key={cl}
                  className="rounded border border-border bg-muted/40 px-1 py-0.5 text-[10px] font-mono text-muted-foreground"
                >
                  {cl}
                </li>
              ))}
            </ul>
          </button>
        </li>
      ))}
    </ol>
  );
}
