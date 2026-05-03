// SPDX-License-Identifier: BUSL-1.1
'use client';

/**
 * RiskIndicator — three-state risk pill for the Audit Dashboard per v3
 * §15.14: "On track" | "Coverage gap" | "Time overrun".
 */

import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import * as React from 'react';

import type { AuditRiskFlag } from '@/lib/mocks/workspace-mock';

const META: Record<AuditRiskFlag, { label: string; tone: string; icon: React.ElementType }> = {
  on_track: { label: 'On track', tone: 'bg-success/15 text-success border-success/30', icon: CheckCircle2 },
  coverage_gap: { label: 'Coverage gap', tone: 'bg-warning/15 text-warning border-warning/30', icon: AlertTriangle },
  time_overrun: { label: 'Time overrun', tone: 'bg-destructive/15 text-destructive border-destructive/30', icon: Clock },
};

export function RiskIndicator({ risk }: { risk: AuditRiskFlag }) {
  const m = META[risk];
  const Icon = m.icon;
  return (
    <span
      role="status"
      aria-label={`Audit risk: ${m.label}`}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${m.tone}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}
