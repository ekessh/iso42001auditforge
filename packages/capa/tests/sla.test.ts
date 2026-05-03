// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { evaluateSla } from '../src/sla.js';
import type { CorrectiveAction } from '../src/domain.js';

function ca(target: string, status: CorrectiveAction['status'] = 'accepted'): CorrectiveAction {
  return {
    id: 'a', firmId: 'f', engagementId: 'e', findingId: 'fnd', proposedBy: 'p',
    proposedAt: new Date().toISOString(), description: 'desc desc', rootCauseAnalysis: 'rca rca',
    plannedActions: [{ description: 'a', owner: 'o', due: target }],
    targetCloseDate: target, status,
  };
}

describe('SLA tracker', () => {
  it('on track when far', () => {
    const t = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    expect(evaluateSla(ca(t))).toBe('on_track');
  });
  it('at risk near target', () => {
    const t = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    expect(evaluateSla(ca(t))).toBe('at_risk');
  });
  it('overdue past target', () => {
    const t = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
    expect(evaluateSla(ca(t))).toBe('overdue');
  });
  it('verified counts as on_track', () => {
    const t = new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString();
    expect(evaluateSla(ca(t, 'verified'))).toBe('on_track');
  });
});
