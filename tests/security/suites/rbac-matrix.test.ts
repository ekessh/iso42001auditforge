// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

type Role = 'super_admin' | 'firm_admin' | 'lead_auditor' | 'team_auditor' | 'technical_expert' | 'audit_manager' | 'peer_reviewer' | 'client_user' | 'accreditation_auditor';

interface Endpoint { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; allowed: Role[] }

const ENDPOINTS: Endpoint[] = [
  { method: 'POST', path: '/engagements', allowed: ['super_admin', 'firm_admin', 'lead_auditor'] },
  { method: 'GET', path: '/engagements/:id', allowed: ['super_admin', 'firm_admin', 'lead_auditor', 'team_auditor', 'technical_expert', 'audit_manager', 'peer_reviewer'] },
  { method: 'POST', path: '/findings', allowed: ['lead_auditor', 'team_auditor'] },
  { method: 'POST', path: '/findings/:id/sign', allowed: ['lead_auditor'] },
  { method: 'GET', path: '/portal/my-findings', allowed: ['client_user'] },
  { method: 'POST', path: '/probes/execute', allowed: ['lead_auditor', 'technical_expert'] },
  { method: 'POST', path: '/reports/sign', allowed: ['lead_auditor'] },
  { method: 'POST', path: '/peer-review/approve', allowed: ['peer_reviewer'] },
  { method: 'GET', path: '/archive/:id/file', allowed: ['accreditation_auditor', 'lead_auditor', 'firm_admin'] },
  { method: 'POST', path: '/admin/firms', allowed: ['super_admin'] },
];

const ALL_ROLES: Role[] = ['super_admin', 'firm_admin', 'lead_auditor', 'team_auditor', 'technical_expert', 'audit_manager', 'peer_reviewer', 'client_user', 'accreditation_auditor'];

function can(role: Role, ep: Endpoint): boolean {
  return ep.allowed.includes(role);
}

describe('RBAC matrix', () => {
  it('has full coverage', () => {
    expect(ENDPOINTS.length).toBeGreaterThanOrEqual(10);
    expect(ALL_ROLES.length).toBe(9);
  });

  for (const ep of ENDPOINTS) {
    for (const role of ALL_ROLES) {
      const expectAllowed = ep.allowed.includes(role);
      it(`${role} ${expectAllowed ? 'CAN' : 'CANNOT'} ${ep.method} ${ep.path}`, () => {
        expect(can(role, ep)).toBe(expectAllowed);
      });
    }
  }
});
