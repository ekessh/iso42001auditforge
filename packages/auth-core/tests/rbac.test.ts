// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ACTIONS,
  buildFullPermissionMatrix,
  can,
  canScope,
  RESOURCES,
  ROLES,
  type Action,
  type Resource,
  type Role,
} from '../src/rbac.js';

describe('rbac matrix', () => {
  it('matrix is exhaustive: every (role, resource, action) tuple has a defined scope', () => {
    const m = buildFullPermissionMatrix();
    expect(m).toHaveLength(ROLES.length * RESOURCES.length * ACTIONS.length);
    for (const p of m) {
      expect(['own', 'firm', 'engagement', 'global', 'none']).toContain(p.scope);
    }
  });

  it('super_admin has access to every resource × action', () => {
    for (const r of RESOURCES) {
      for (const a of ACTIONS) {
        expect(can('super_admin', a, r)).toBe(true);
        expect(canScope('super_admin', a, r)).toBe('global');
      }
    }
  });

  it('client_user cannot read working_papers, ledger, peer_review, or auditors', () => {
    const denied: [Resource, Action][] = [
      ['working_paper', 'read'],
      ['ledger_event', 'read'],
      ['peer_review', 'read'],
      ['auditor', 'read'],
      ['firm', 'read'],
    ];
    for (const [r, a] of denied) {
      expect(can('client_user', a, r)).toBe(false);
    }
  });

  it('accreditation_auditor is read-only across the board', () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        if (action === 'read' || action === 'export') continue;
        expect(can('accreditation_auditor', action, resource)).toBe(false);
      }
    }
  });

  it('only lead_auditor and peer_reviewer can sign reports/findings', () => {
    const signers: Role[] = [];
    for (const role of ROLES) {
      if (can(role, 'sign', 'finding') || can(role, 'sign', 'report')) {
        signers.push(role);
      }
    }
    expect(new Set(signers)).toEqual(new Set(['super_admin', 'lead_auditor', 'peer_reviewer']));
  });

  it('peer_reviewer cannot edit working_papers (separation of duties)', () => {
    expect(can('peer_reviewer', 'update', 'working_paper')).toBe(false);
    expect(can('peer_reviewer', 'create', 'working_paper')).toBe(false);
    expect(can('peer_reviewer', 'delete', 'working_paper')).toBe(false);
  });

  it('only firm_admin and audit_manager can manage auditors', () => {
    const managers: Role[] = [];
    for (const role of ROLES) {
      if (can(role, 'create', 'auditor') || can(role, 'update', 'auditor')) {
        managers.push(role);
      }
    }
    const set = new Set(managers);
    expect(set.has('firm_admin')).toBe(true);
    expect(set.has('audit_manager')).toBe(true);
    expect(set.has('lead_auditor')).toBe(false);
    expect(set.has('team_auditor')).toBe(false);
  });

  it('property: every role can read the catalogue (global)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ROLES), (role) => {
        expect(can(role, 'read', 'catalogue')).toBe(true);
      }),
    );
  });

  it('property: client_user can only ever access OWN scope or global catalogue', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RESOURCES),
        fc.constantFrom(...ACTIONS),
        (resource, action) => {
          const scope = canScope('client_user', action, resource);
          expect(['own', 'global', 'none']).toContain(scope);
        },
      ),
    );
  });

  it('every action constant is referenced for at least one role/resource', () => {
    const usedActions = new Set<Action>();
    for (const p of buildFullPermissionMatrix()) {
      if (p.scope !== 'none') usedActions.add(p.action);
    }
    for (const a of ACTIONS) {
      expect(usedActions.has(a)).toBe(true);
    }
  });

  it('every resource constant is referenced for at least one role', () => {
    const usedResources = new Set<Resource>();
    for (const p of buildFullPermissionMatrix()) {
      if (p.scope !== 'none') usedResources.add(p.resource);
    }
    for (const r of RESOURCES) {
      expect(usedResources.has(r)).toBe(true);
    }
  });
});
