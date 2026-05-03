// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { next, allowedActionsForRole, isTerminal } from '../src/state-machine.js';

describe('CAPA state machine', () => {
  it('happy path proposed -> closed', () => {
    let s: ReturnType<typeof next> = 'proposed';
    s = next(s, 'auditor.accept');
    expect(s).toBe('accepted');
    s = next(s, 'auditee.implement');
    expect(s).toBe('implemented');
    s = next(s, 'auditor.verify');
    expect(s).toBe('verified');
    s = next(s, 'lead_auditor.close');
    expect(s).toBe('closed');
    expect(isTerminal(s)).toBe(true);
  });
  it('reject + repropose loop', () => {
    let s = next('proposed', 'auditor.reject');
    expect(s).toBe('rejected');
    s = next(s, 'auditee.repropose');
    expect(s).toBe('proposed');
  });
  it.each([
    ['proposed', 'auditee.implement'],
    ['accepted', 'auditor.reject'],
    ['closed', 'auditor.accept'],
  ])('forbidden transition %s via %s', (from, action) => {
    expect(() => next(from as 'proposed', action)).toThrow();
  });
  it('role-scoped allowed actions', () => {
    expect(allowedActionsForRole('proposed', 'auditor')).toEqual(['auditor.accept', 'auditor.reject']);
    expect(allowedActionsForRole('proposed', 'auditee')).toEqual([]);
  });
});
