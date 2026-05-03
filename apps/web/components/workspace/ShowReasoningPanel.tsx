// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ShowReasoningPanel — disclosure that exposes a reasoning-tier model trace.
 *
 * Per v3 §15.11 + §17.2, when the model used to compose a system suggestion
 * is a reasoning model and emits step-wise rationale, we surface it here so
 * the auditor can see *exactly* which considerations led to the question.
 * Trace renders monospace, collapsed by default. Long traces scroll.
 */

import { ChevronDown, ChevronRight } from 'lucide-react';
import * as React from 'react';

import type { ReasoningTrace } from '@/lib/mocks/workspace-mock';

export interface ShowReasoningPanelProps {
  trace: ReasoningTrace;
  open: boolean;
  onToggle: () => void;
  /** id used to associate trigger -> region. */
  panelId: string;
}

export function ShowReasoningPanel({
  trace,
  open,
  onToggle,
  panelId,
}: ShowReasoningPanelProps) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {open ? (
          <ChevronDown className="size-3" aria-hidden />
        ) : (
          <ChevronRight className="size-3" aria-hidden />
        )}
        Show reasoning
        <span className="ml-1 rounded bg-muted px-1 font-mono">{trace.model}</span>
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={`Reasoning trace from ${trace.model}`}
        hidden={!open}
        className={
          'mt-1.5 overflow-auto rounded-md border border-border bg-background ' +
          (open ? 'motion-safe:animate-fade-in max-h-56' : '')
        }
      >
        {open ? (
          <pre className="m-0 p-2 text-2xs font-mono leading-relaxed text-foreground whitespace-pre-wrap">
            {trace.steps.join('\n')}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
