// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { StateMachineError } from '@auditforge/shared';
import {
  TRANSITIONS,
  canPerform,
  isTerminal,
  listAllowedActions,
  nextStatus,
} from '../src/workflow/state-machine.js';
import { ALL_PEER_REVIEW_STATUSES } from '../src/domain/enums.js';

describe('peer-review state machine', () => {
  it('exposes all 7 transitions with stable shape', () => {
    expect(TRANSITIONS).toHaveLength(7);
    for (const t of TRANSITIONS) {
      expect(typeof t.action).toBe('string');
      expect(typeof t.from).toBe('string');
      expect(typeof t.to).toBe('string');
    }
  });

  it('terminal statuses have no outgoing transitions', () => {
    expect(isTerminal('approved')).toBe(true);
    expect(isTerminal('withdrawn')).toBe(true);
    expect(listAllowedActions('approved')).toEqual([]);
    expect(listAllowedActions('withdrawn')).toEqual([]);
  });

  it('non-terminal statuses each list at least one action', () => {
    for (const s of ALL_PEER_REVIEW_STATUSES) {
      if (s === 'approved' || s === 'withdrawn') continue;
      expect(listAllowedActions(s).length).toBeGreaterThan(0);
    }
  });

  it('rejects illegal transitions with StateMachineError', () => {
    expect(() => nextStatus('approved', 'assign')).toThrowError(StateMachineError);
    expect(() => nextStatus('withdrawn', 'resubmit')).toThrowError(StateMachineError);
    expect(() => nextStatus('pending', 'approve')).toThrowError(StateMachineError);
    expect(() => nextStatus('pending', 'request_changes')).toThrowError(StateMachineError);
  });

  it('exhaustive (status, action) sweep matches table', () => {
    const allActions = ['assign', 'request_changes', 'resubmit', 'approve', 'withdraw'] as const;
    for (const s of ALL_PEER_REVIEW_STATUSES) {
      for (const a of allActions) {
        const allowed = TRANSITIONS.find((t) => t.from === s && t.action === a);
        if (allowed) {
          expect(canPerform(s, a)).toBe(true);
          expect(nextStatus(s, a)).toBe(allowed.to);
        } else {
          expect(canPerform(s, a)).toBe(false);
          expect(() => nextStatus(s, a)).toThrowError(StateMachineError);
        }
      }
    }
  });

  it('canonical happy path: pending -> in_review -> changes_requested -> in_review -> approved', () => {
    expect(nextStatus('pending', 'assign')).toBe('in_review');
    expect(nextStatus('in_review', 'request_changes')).toBe('changes_requested');
    expect(nextStatus('changes_requested', 'resubmit')).toBe('in_review');
    expect(nextStatus('in_review', 'approve')).toBe('approved');
  });

  it('withdraw is allowed from all non-terminal states', () => {
    expect(nextStatus('pending', 'withdraw')).toBe('withdrawn');
    expect(nextStatus('in_review', 'withdraw')).toBe('withdrawn');
    expect(nextStatus('changes_requested', 'withdraw')).toBe('withdrawn');
  });
});
