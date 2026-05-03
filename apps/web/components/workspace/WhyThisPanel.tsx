// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * WhyThisPanel — disclosure showing why the engine selected this question.
 *
 * Per v3 §15.11, every system suggestion exposes a "Why this?" inline action.
 * This component renders the resulting disclosure, listing:
 *   - the rationale string from the engine
 *   - the provenance chain (clauses, library template, claims, system profile)
 *
 * The panel is a controlled disclosure so the caller (chat stream) can wire
 * keyboard navigation. Respects prefers-reduced-motion.
 */

import { ChevronDown, FileText, Layers, Library, Sparkles } from 'lucide-react';
import * as React from 'react';

import type { ProvenanceLink } from '@/lib/mocks/workspace-mock';

export interface WhyThisPanelProps {
  open: boolean;
  rationale: string;
  provenance: ProvenanceLink[];
  panelId: string;
}

const KIND_ICON: Record<NonNullable<ProvenanceLink['kind']>, React.ElementType> = {
  clause: FileText,
  library: Library,
  claim: Sparkles,
  profile: Layers,
};

export function WhyThisPanel({ open, rationale, provenance, panelId }: WhyThisPanelProps) {
  return (
    <div
      id={panelId}
      role="region"
      aria-label="Why this question was suggested"
      hidden={!open}
      className={
        'mt-3 overflow-hidden rounded-md border border-border bg-muted/30 ' +
        (open
          ? 'motion-safe:animate-fade-in'
          : '')
      }
    >
      {open ? (
        <div className="p-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground">
            <ChevronDown className="size-3" aria-hidden />
            Rationale
          </div>
          <p className="mt-1.5 text-foreground leading-relaxed">{rationale}</p>

          <div className="mt-3">
            <div className="font-semibold uppercase tracking-wide text-muted-foreground text-[10px]">
              Provenance
            </div>
            <ul className="mt-1.5 space-y-1">
              {provenance.map((p) => {
                const Icon = KIND_ICON[p.kind ?? 'clause'];
                return (
                  <li key={p.id} className="flex items-center gap-1.5 text-foreground">
                    <Icon className="size-3 text-muted-foreground" aria-hidden />
                    {p.href ? (
                      <a
                        href={p.href}
                        className="underline decoration-dotted underline-offset-2 hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                      >
                        {p.label}
                      </a>
                    ) : (
                      <span>{p.label}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
