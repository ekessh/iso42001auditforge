// SPDX-License-Identifier: BUSL-1.1
import type { CorrectiveAction } from './domain.js';

export type SlaStatus = 'on_track' | 'at_risk' | 'overdue';

export interface SlaTrackerOpts {
  warningDays: number;
}

export const DEFAULT_SLA_OPTS: SlaTrackerOpts = { warningDays: 7 };

export function evaluateSla(ca: CorrectiveAction, now = new Date(), opts = DEFAULT_SLA_OPTS): SlaStatus {
  if (ca.status === 'closed' || ca.status === 'verified') return 'on_track';
  const target = new Date(ca.targetCloseDate).getTime();
  const ms = target - now.getTime();
  const days = ms / (1000 * 3600 * 24);
  if (days < 0) return 'overdue';
  if (days <= opts.warningDays) return 'at_risk';
  return 'on_track';
}
