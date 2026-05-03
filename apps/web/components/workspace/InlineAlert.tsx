// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * InlineAlert — coverage gap / contradiction / termination notice in the
 * chat stream.
 *
 * Per v3 §15.11:
 *  - Contradiction detected: "This answer contradicts a claim from the
 *    10:15 interview..." with [Inject question] action.
 *  - Coverage threshold reached: "Scope substantially covered for A.7…"
 *  - Termination conditions met: terminal modal — represented here as the
 *    inline lead-in.
 *
 * Coverage / termination alerts use aria-live="polite"; contradictions are
 * promoted to aria-live="assertive" (rendered by the parent stream wrapper)
 * because they can invalidate prior conclusions if missed.
 */

import { AlertTriangle, GitMerge, Flag } from 'lucide-react';
import * as React from 'react';

import type { AlertKind } from '@/lib/mocks/workspace-mock';

export interface InlineAlertProps {
  kind: AlertKind;
  what: string;
  remediation?: string | undefined;
  onAction?: (() => void) | undefined;
  actionLabel?: string | undefined;
}

const KIND_META: Record<AlertKind, { icon: React.ElementType; label: string; tone: string; bar: string }> = {
  coverage_gap: {
    icon: AlertTriangle,
    label: 'Coverage gap detected',
    tone: 'bg-warning/10 text-foreground',
    bar: 'border-l-4 border-l-warning',
  },
  contradiction: {
    icon: GitMerge,
    label: 'Contradiction detected',
    tone: 'bg-destructive/10 text-foreground',
    bar: 'border-l-4 border-l-destructive',
  },
  termination: {
    icon: Flag,
    label: 'Termination condition reached',
    tone: 'bg-info/10 text-foreground',
    bar: 'border-l-4 border-l-info',
  },
};

export function InlineAlert({ kind, what, remediation, onAction, actionLabel }: InlineAlertProps) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const ariaLive = kind === 'contradiction' || kind === 'termination' ? 'assertive' : 'polite';
  return (
    <div
      role="alert"
      aria-live={ariaLive}
      className={`rounded-md ${meta.bar} ${meta.tone} px-3 py-2.5 motion-safe:animate-fade-in`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
            {meta.label}
          </div>
          <p className="mt-0.5 text-sm leading-relaxed text-foreground">{what}</p>
          {remediation || onAction ? (
            <div className="mt-2 flex items-center gap-2">
              {onAction ? (
                <button
                  type="button"
                  onClick={onAction}
                  className="inline-flex items-center rounded-md bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground hover:bg-warning/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {actionLabel ?? 'Inject follow-up'}
                </button>
              ) : null}
              {remediation ? (
                <span className="text-2xs text-muted-foreground">{remediation}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
