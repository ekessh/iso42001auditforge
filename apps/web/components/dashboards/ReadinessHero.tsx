// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * ReadinessHero — top strip for the Readiness Dashboard per v3 §15.14.
 *
 * Shows the overall weighted readiness %, 30-day and 90-day trend deltas,
 * and a target-certification-date countdown if one is configured. The "?"
 * trigger opens the methodology disclosure (transparent calculation per
 * v3 §15.14: "Every dashboard surfaces a 'How is this calculated?' tooltip
 * on the hero metric.").
 */

import { ArrowDown, ArrowUp, HelpCircle, Calendar } from 'lucide-react';
import * as React from 'react';

export interface ReadinessHeroProps {
  pct: number;
  delta30d: number;
  delta90d: number;
  daysToTarget: number;
  targetDate: string;
  weightDescription: string;
}

export function ReadinessHero({
  pct,
  delta30d,
  delta90d,
  daysToTarget,
  targetDate,
  weightDescription,
}: ReadinessHeroProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <section
      aria-labelledby="readiness-hero"
      className="rounded-xl border border-border bg-card p-5 shadow-xs"
    >
      <header className="flex items-center justify-between">
        <h2
          id="readiness-hero"
          className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Overall Readiness (weighted)
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="readiness-method"
          className="inline-flex items-center gap-1 rounded text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className="size-3.5" aria-hidden />
          How is this calculated?
        </button>
      </header>

      <div className="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
        <div>
          <div
            className="text-5xl font-semibold tabular-nums tracking-tight text-foreground"
            aria-label={`${pct}% overall readiness`}
          >
            {pct}%
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-2xs text-muted-foreground">
            <Trend label="30d" delta={delta30d} />
            <Trend label="90d" delta={delta90d} />
          </div>
        </div>

        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-2xs">
          <div className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden />
            Target certification
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground tabular-nums">{targetDate}</div>
          <div className="text-2xs text-muted-foreground tabular-nums">{daysToTarget} days remaining</div>
        </div>
      </div>

      <div
        id="readiness-method"
        role="region"
        aria-label="Readiness % methodology"
        hidden={!open}
        className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-2xs leading-relaxed text-foreground"
      >
        <p className="font-medium">Methodology</p>
        <p className="mt-1 whitespace-pre-line text-muted-foreground">{weightDescription}</p>
        <p className="mt-2 text-muted-foreground">
          Methodology changes are part of the audit ledger; weight overrides
          require auditor or admin action and are signed.
        </p>
      </div>
    </section>
  );
}

function Trend({ delta, label }: { delta: number; label: string }) {
  const up = delta >= 0;
  const Arrow = up ? ArrowUp : ArrowDown;
  const tone = up ? 'text-success' : 'text-destructive';
  return (
    <span
      className="inline-flex items-center gap-1"
      aria-label={`${label} trend: ${up ? 'up' : 'down'} ${Math.abs(delta)} percentage points`}
    >
      <Arrow className={`size-3 ${tone}`} aria-hidden />
      <span className={tone}>
        {up ? '+' : ''}
        {delta} pp
      </span>
      <span>{label}</span>
    </span>
  );
}
