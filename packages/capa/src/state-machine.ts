// SPDX-License-Identifier: BUSL-1.1
import type { CaStatus } from './domain.js';

export type Role = 'auditor' | 'auditee' | 'lead_auditor';

const TRANSITIONS: Record<CaStatus, Record<string, CaStatus>> = {
  proposed: { 'auditor.accept': 'accepted', 'auditor.reject': 'rejected' },
  accepted: { 'auditee.implement': 'implemented' },
  rejected: { 'auditee.repropose': 'proposed' },
  implemented: { 'auditor.verify': 'verified' },
  verified: { 'lead_auditor.close': 'closed' },
  closed: {},
};

export interface Transition {
  from: CaStatus;
  action: string;
  role: Role;
  to: CaStatus;
}

export function next(from: CaStatus, action: string): CaStatus {
  const to = TRANSITIONS[from][action];
  if (!to) throw new Error(`forbidden transition ${from} via ${action}`);
  return to;
}

export function allowedActionsForRole(from: CaStatus, role: Role): string[] {
  return Object.keys(TRANSITIONS[from]).filter((a) => a.startsWith(`${role}.`));
}

export function isTerminal(s: CaStatus): boolean {
  return Object.keys(TRANSITIONS[s]).length === 0;
}
