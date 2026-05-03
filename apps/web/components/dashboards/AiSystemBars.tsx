// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * AiSystemBars — per-AI-system readiness bars per v3 §15.14.
 *
 * "A firm with one mature LLM and one nascent agentic workflow shows two
 * very different bars. Drives prioritisation."
 */

import * as React from 'react';

import type { ReadinessAiSystemBar } from '@/lib/mocks/workspace-mock';

export interface AiSystemBarsProps {
  systems: ReadinessAiSystemBar[];
}

export function AiSystemBars({ systems }: AiSystemBarsProps) {
  return (
    <section
      aria-labelledby="ai-system-breakdown"
      className="rounded-lg border border-border bg-card p-4 shadow-xs"
    >
      <header className="flex items-center justify-between">
        <h2
          id="ai-system-breakdown"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          AI System breakdown
        </h2>
      </header>
      <ul className="mt-3 space-y-2.5">
        {systems.map((s) => {
          const tone =
            s.readinessPct >= 80
              ? 'bg-success'
              : s.readinessPct >= 60
                ? 'bg-info'
                : s.readinessPct >= 40
                  ? 'bg-warning'
                  : 'bg-destructive';
          return (
            <li key={s.systemId}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-foreground">{s.systemName}</span>
                <span className="ml-2 tabular-nums text-foreground">{s.readinessPct}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={s.readinessPct}
                aria-label={`${s.systemName} readiness`}
                className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={`h-full rounded-full ${tone}`}
                  style={{ width: `${s.readinessPct}%` }}
                />
              </div>
              <div className="mt-0.5 text-2xs text-muted-foreground">
                weight {Math.round(s.weight * 100)}%
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
