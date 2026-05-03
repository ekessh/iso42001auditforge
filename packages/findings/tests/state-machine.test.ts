// SPDX-License-Identifier: BUSL-1.1
import { describe, it, expect } from 'vitest';
import { StateMachineError } from '@auditforge/shared';
import {
  ALL_FINDING_ROLES,
  ALL_FINDING_STATUSES,
  TRANSITIONS,
  canTransition,
  createDefaultStateMachine,
  lookupTransition,
  requireTransition,
  type FindingRole,
  type FindingStatus,
  type TransitionAction,
} from '../src/index.js';
import { nextAuditorId } from './helpers.js';

const ALL_ACTIONS: readonly TransitionAction[] = [
  'issue',
  'accept',
  'dispute',
  'resolve',
  'close',
  'reopen',
];

describe('Finding state machine — exhaustive', () => {
  it('every transition is unique on (action,from)', () => {
    const seen = new Set<string>();
    for (const t of TRANSITIONS) {
      const key = `${t.action}::${t.from}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('lookupTransition returns the canonical entry or undefined', () => {
    expect(lookupTransition('issue', 'draft')?.to).toBe('issued');
    expect(lookupTransition('close', 'draft')).toBeUndefined();
  });

  it('canTransition reports no_transition for invalid (action,from)', () => {
    const result = canTransition({
      action: 'close',
      from: 'draft',
      role: 'lead_auditor',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_transition');
  });

  it('canTransition reports role_denied when only role is wrong', () => {
    const result = canTransition({
      action: 'issue',
      from: 'draft',
      role: 'auditee',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('role_denied');
  });

  it('exhaustive transition × role matrix matches the table', () => {
    let allowedCount = 0;
    let deniedCount = 0;
    let noTxCount = 0;
    for (const action of ALL_ACTIONS) {
      for (const from of ALL_FINDING_STATUSES) {
        for (const role of ALL_FINDING_ROLES) {
          const r = canTransition({ action, from, role });
          const t = lookupTransition(action, from);
          if (!t) {
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toBe('no_transition');
            noTxCount += 1;
            continue;
          }
          const allowed = t.allowedRoles.includes(role);
          if (allowed) {
            expect(r.ok).toBe(true);
            if (r.ok) expect(r.to).toBe(t.to);
            allowedCount += 1;
          } else {
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toBe('role_denied');
            deniedCount += 1;
          }
        }
      }
    }
    // Sanity: total must equal actions × statuses × roles.
    expect(allowedCount + deniedCount + noTxCount).toBe(
      ALL_ACTIONS.length *
        ALL_FINDING_STATUSES.length *
        ALL_FINDING_ROLES.length,
    );
  });

  it('requireTransition throws StateMachineError on invalid action', () => {
    expect(() =>
      requireTransition({
        action: 'close',
        from: 'draft',
        role: 'lead_auditor',
      }),
    ).toThrow(StateMachineError);
  });

  it('requireTransition throws on role denial', () => {
    expect(() =>
      requireTransition({
        action: 'issue',
        from: 'draft',
        role: 'auditee',
      }),
    ).toThrow(StateMachineError);
  });

  it('requireTransition returns the next status on success', () => {
    expect(
      requireTransition({
        action: 'issue',
        from: 'draft',
        role: 'lead_auditor',
      }),
    ).toBe('issued');
  });
});

describe('createDefaultStateMachine.apply', () => {
  it('produces a disposition history entry with correct fields', () => {
    const m = createDefaultStateMachine();
    const by = nextAuditorId();
    const r = m.apply({
      action: 'issue',
      from: 'draft',
      role: 'lead_auditor',
      by,
      at: '2026-05-01T09:00:00.000Z',
      note: 'first issue',
    });
    expect(r.to).toBe('issued');
    expect(r.entry.action).toBe('issue');
    expect(r.entry.fromStatus).toBe('draft');
    expect(r.entry.toStatus).toBe('issued');
    expect(r.entry.by).toBe(by);
    expect(r.entry.note).toBe('first issue');
  });

  it('applies the canonical accept→resolve→close path end to end', () => {
    const m = createDefaultStateMachine();
    const by = nextAuditorId();
    const a1 = m.apply({
      action: 'issue',
      from: 'draft',
      role: 'lead_auditor',
      by,
      at: 'x',
    });
    const a2 = m.apply({
      action: 'accept',
      from: a1.to,
      role: 'auditee',
      by,
      at: 'x',
    });
    const a3 = m.apply({
      action: 'resolve',
      from: a2.to,
      role: 'lead_auditor',
      by,
      at: 'x',
    });
    const a4 = m.apply({
      action: 'close',
      from: a3.to,
      role: 'lead_auditor',
      by,
      at: 'x',
    });
    expect([a1.to, a2.to, a3.to, a4.to]).toEqual([
      'issued',
      'accepted',
      'resolved',
      'closed',
    ]);
  });

  it('disputed → resolve is restricted to lead_auditor', () => {
    const m = createDefaultStateMachine();
    expect(
      m.can({ action: 'resolve', from: 'disputed', role: 'reviewer' }).ok,
    ).toBe(false);
    expect(
      m.can({ action: 'resolve', from: 'disputed', role: 'lead_auditor' }).ok,
    ).toBe(true);
  });

  it('reopen returns from resolved → accepted', () => {
    const m = createDefaultStateMachine();
    const r = m.apply({
      action: 'reopen',
      from: 'resolved',
      role: 'lead_auditor',
      by: nextAuditorId(),
      at: 'x',
    });
    expect(r.to).toBe('accepted');
  });

  it('reopen from closed is rejected (closed is terminal except via reopen-after-resolve in CAPA)', () => {
    const m = createDefaultStateMachine();
    expect(
      m.can({ action: 'reopen', from: 'closed', role: 'lead_auditor' }).ok,
    ).toBe(false);
  });
});

describe('Role-status matrix golden checks', () => {
  // A handful of golden cases to lock down the contract beyond the
  // exhaustive sweep above.
  const GOLDEN: Array<{
    a: TransitionAction;
    f: FindingStatus;
    r: FindingRole;
    ok: boolean;
  }> = [
    { a: 'issue', f: 'draft', r: 'lead_auditor', ok: true },
    { a: 'issue', f: 'draft', r: 'auditor', ok: true },
    { a: 'issue', f: 'draft', r: 'auditee', ok: false },
    { a: 'issue', f: 'draft', r: 'reviewer', ok: false },
    { a: 'dispute', f: 'issued', r: 'auditee', ok: true },
    { a: 'dispute', f: 'issued', r: 'lead_auditor', ok: false },
    { a: 'accept', f: 'disputed', r: 'auditee', ok: true },
    { a: 'accept', f: 'disputed', r: 'auditor', ok: false },
    { a: 'resolve', f: 'accepted', r: 'reviewer', ok: true },
    { a: 'close', f: 'resolved', r: 'auditor', ok: true },
    { a: 'close', f: 'resolved', r: 'reviewer', ok: false },
    { a: 'close', f: 'resolved', r: 'auditee', ok: false },
    { a: 'reopen', f: 'resolved', r: 'auditor', ok: true },
  ];
  for (const g of GOLDEN) {
    it(`${g.a} from ${g.f} as ${g.r} -> ${g.ok ? 'allowed' : 'denied'}`, () => {
      expect(canTransition({ action: g.a, from: g.f, role: g.r }).ok).toBe(
        g.ok,
      );
    });
  }
});
