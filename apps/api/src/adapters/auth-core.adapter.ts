// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-1): replace with packages/auth-core when available.
// Local RBAC matrix and role helpers.

export type Role =
  | 'super_admin'
  | 'firm_admin'
  | 'lead_auditor'
  | 'auditor'
  | 'technical_expert'
  | 'peer_reviewer'
  | 'observer'
  | 'accreditation_inspector'
  | 'service';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'sign' | 'archive' | 'admin';

const MATRIX: Record<Role, ReadonlyArray<{ resource: string; actions: ReadonlyArray<Action> }>> = {
  super_admin: [{ resource: '*', actions: ['read', 'create', 'update', 'delete', 'sign', 'archive', 'admin'] }],
  firm_admin: [
    { resource: 'tenancy', actions: ['read', 'create', 'update', 'admin'] },
    { resource: 'clients', actions: ['read', 'create', 'update', 'delete'] },
    { resource: 'engagements', actions: ['read', 'create', 'update', 'delete'] },
    { resource: '*', actions: ['read'] },
  ],
  lead_auditor: [
    { resource: 'engagements', actions: ['read', 'create', 'update'] },
    { resource: 'audit-plans', actions: ['read', 'create', 'update'] },
    { resource: 'working-papers', actions: ['read', 'create', 'update'] },
    { resource: 'findings', actions: ['read', 'create', 'update'] },
    { resource: 'reports', actions: ['read', 'create', 'update', 'sign'] },
    { resource: 'capa', actions: ['read', 'create', 'update'] },
    { resource: '*', actions: ['read'] },
  ],
  auditor: [
    { resource: 'working-papers', actions: ['read', 'create', 'update'] },
    { resource: 'findings', actions: ['read', 'create', 'update'] },
    { resource: 'evidence-vault', actions: ['read', 'create'] },
    { resource: 'samples', actions: ['read', 'create'] },
    { resource: 'interviews', actions: ['read', 'create', 'update'] },
    { resource: 'probes', actions: ['read', 'create'] },
    { resource: '*', actions: ['read'] },
  ],
  technical_expert: [
    { resource: 'probes', actions: ['read', 'create', 'update'] },
    { resource: 'traces', actions: ['read'] },
    { resource: 'working-papers', actions: ['read', 'update'] },
    { resource: '*', actions: ['read'] },
  ],
  peer_reviewer: [
    { resource: 'peer-review', actions: ['read', 'create', 'update'] },
    { resource: 'reports', actions: ['read'] },
    { resource: '*', actions: ['read'] },
  ],
  observer: [{ resource: '*', actions: ['read'] }],
  accreditation_inspector: [
    { resource: 'archive', actions: ['read'] },
    { resource: 'reports', actions: ['read'] },
    { resource: 'audit-ledger', actions: ['read'] },
  ],
  service: [{ resource: '*', actions: ['read', 'create', 'update'] }],
};

export function can(roles: readonly Role[], resource: string, action: Action): boolean {
  for (const role of roles) {
    const entries = MATRIX[role];
    if (!entries) continue;
    for (const e of entries) {
      if ((e.resource === resource || e.resource === '*') && e.actions.includes(action)) return true;
    }
  }
  return false;
}

export const RBAC_MATRIX = MATRIX;
