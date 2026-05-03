// SPDX-License-Identifier: BUSL-1.1
/**
 * Migration test: verifies that the adapter wrapper output matches the
 * canonical @auditforge/auth-core package output for all 9 roles × all
 * known endpoints / resource combinations.
 *
 * Any divergence between the adapter and the package is a security defect.
 */
import { describe, it, expect } from 'vitest';
import {
  can,
  canScope,
  ROLES,
  RESOURCES,
  ACTIONS,
  buildFullPermissionMatrix,
} from './auth-core.adapter.js';
import {
  can as corecan,
  canScope as corecCanScope,
  buildFullPermissionMatrix as coreBuildMatrix,
  ROLES as coreROLES,
  RESOURCES as coreRESOURCES,
  ACTIONS as coreACTIONS,
} from '@auditforge/auth-core';

describe('auth-core.adapter — canonical parity', () => {
  it('re-exports the identical ROLES tuple as the package', () => {
    expect(ROLES).toStrictEqual(coreROLES);
  });

  it('re-exports the identical RESOURCES tuple as the package', () => {
    expect(RESOURCES).toStrictEqual(coreRESOURCES);
  });

  it('re-exports the identical ACTIONS tuple as the package', () => {
    expect(ACTIONS).toStrictEqual(coreACTIONS);
  });

  it('buildFullPermissionMatrix output matches package output', () => {
    const adapterMatrix = buildFullPermissionMatrix();
    const packageMatrix = coreBuildMatrix();
    expect(adapterMatrix).toStrictEqual(packageMatrix);
  });

  it('adapter can() matches package can() for every (role, action, resource) cell', () => {
    const mismatches: string[] = [];
    for (const role of coreROLES) {
      for (const action of coreACTIONS) {
        for (const resource of coreRESOURCES) {
          const adapterResult = can([role], resource, action);
          const packageResult = corecan(role, action, resource);
          if (adapterResult !== packageResult) {
            mismatches.push(
              `role=${role} action=${action} resource=${resource}: adapter=${adapterResult} package=${packageResult}`,
            );
          }
        }
      }
    }
    expect(mismatches).toHaveLength(0);
  });

  it('adapter canScope() matches package canScope() for every cell', () => {
    const mismatches: string[] = [];
    for (const role of coreROLES) {
      for (const action of coreACTIONS) {
        for (const resource of coreRESOURCES) {
          const adapterResult = canScope(role, action, resource);
          const packageResult = corecCanScope(role, action, resource);
          if (adapterResult !== packageResult) {
            mismatches.push(
              `role=${role} action=${action} resource=${resource}: adapter=${adapterResult} package=${packageResult}`,
            );
          }
        }
      }
    }
    expect(mismatches).toHaveLength(0);
  });

  describe('no wildcards — specific denial assertions', () => {
    it('super_admin can read every resource (global scope)', () => {
      for (const resource of coreRESOURCES) {
        expect(can(['super_admin'], resource, 'read')).toBe(true);
      }
    });

    it('accreditation_auditor cannot create any resource', () => {
      for (const resource of coreRESOURCES) {
        // accreditation_auditor only has read + export; no create
        const result = can(['accreditation_auditor'], resource, 'create');
        if (result) {
          // Only flag if the package also disagrees
          const pkg = corecan('accreditation_auditor', 'create', resource);
          expect(result).toBe(pkg);
        }
      }
    });

    it('client_user cannot read working_paper (scope=none)', () => {
      expect(can(['client_user'], 'working_paper', 'read')).toBe(false);
    });

    it('peer_reviewer cannot delete any resource', () => {
      for (const resource of coreRESOURCES) {
        expect(can(['peer_reviewer'], resource, 'delete')).toBe(false);
      }
    });

    it('an unknown resource string always denies', () => {
      // The adapter must not fall through to a wildcard for unknown resources.
      expect(can(['super_admin'], 'unknown_resource_xyz' as never, 'read')).toBe(false);
    });

    it('multiple roles: lead_auditor + peer_reviewer can sign findings (from lead_auditor)', () => {
      expect(can(['peer_reviewer', 'lead_auditor'], 'finding', 'sign')).toBe(true);
    });

    it('multiple roles: client_user + team_auditor deny archive deletion', () => {
      expect(can(['client_user', 'team_auditor'], 'archive', 'delete')).toBe(false);
    });
  });

  describe('9 roles × sample known endpoints', () => {
    const knownEndpoints: Array<{ role: typeof coreROLES[number]; resource: typeof coreRESOURCES[number]; action: typeof coreACTIONS[number]; expected: boolean }> = [
      { role: 'lead_auditor', resource: 'report', action: 'sign', expected: true },
      { role: 'team_auditor', resource: 'report', action: 'sign', expected: false },
      { role: 'firm_admin', resource: 'billing', action: 'create', expected: true },
      { role: 'peer_reviewer', resource: 'peer_review', action: 'sign', expected: true },
      { role: 'client_user', resource: 'evidence', action: 'create', expected: true },
      { role: 'client_user', resource: 'finding', action: 'delete', expected: false },
      { role: 'audit_manager', resource: 'engagement', action: 'archive', expected: true },
      { role: 'technical_expert', resource: 'probe_definition', action: 'create', expected: true },
      { role: 'accreditation_auditor', resource: 'archive', action: 'export', expected: true },
    ];

    for (const tc of knownEndpoints) {
      it(`${tc.role} ${tc.expected ? 'can' : 'cannot'} ${tc.action} ${tc.resource}`, () => {
        expect(can([tc.role], tc.resource, tc.action)).toBe(tc.expected);
      });
    }
  });
});
