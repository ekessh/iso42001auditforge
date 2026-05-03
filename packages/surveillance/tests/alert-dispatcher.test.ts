// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  AlertDispatcher,
  InMemoryAlertChannel,
} from '../src/alert-dispatcher.js';
import type { SurveillanceAlert } from '../src/domain.js';

const sampleAlert: SurveillanceAlert = {
  alertId: 'a1',
  tenantId: 't1',
  streamId: 's1',
  thresholdId: 'th1',
  severity: 'critical',
  metricType: 'latency',
  observedValue: 1500,
  boundary: 1000,
  op: 'gt',
  raisedAt: '2026-05-03T12:00:00.000Z',
  context: {},
};

describe('AlertDispatcher', () => {
  it('routes by severity filter', async () => {
    const d = new AlertDispatcher();
    const warnOnly = new InMemoryAlertChannel('email', ['warning']);
    const both = new InMemoryAlertChannel('slack', ['warning', 'critical']);
    d.register(warnOnly);
    d.register(both);
    const r = await d.dispatch(sampleAlert);
    expect(r.attempts.find((a) => a.channelId === 'email')).toBeUndefined();
    expect(r.attempts.find((a) => a.channelId === 'slack')?.ok).toBe(true);
  });

  it('reports per-channel failures without short-circuiting', async () => {
    const d = new AlertDispatcher();
    const failing = new InMemoryAlertChannel('failing', ['critical'], { fail: true });
    const ok = new InMemoryAlertChannel('ok', ['critical']);
    d.register(failing);
    d.register(ok);
    const r = await d.dispatch(sampleAlert);
    expect(r.attempts).toHaveLength(2);
    const okResult = r.attempts.find((a) => a.channelId === 'ok');
    const failResult = r.attempts.find((a) => a.channelId === 'failing');
    expect(okResult?.ok).toBe(true);
    expect(failResult?.ok).toBe(false);
  });

  it('returns no attempts when no channel matches severity', async () => {
    const d = new AlertDispatcher();
    d.register(new InMemoryAlertChannel('infoOnly', ['info']));
    const r = await d.dispatch(sampleAlert);
    expect(r.attempts).toEqual([]);
  });

  it('unregister removes channel', async () => {
    const d = new AlertDispatcher();
    d.register(new InMemoryAlertChannel('tmp', ['critical']));
    expect(d.has('tmp')).toBe(true);
    d.unregister('tmp');
    expect(d.has('tmp')).toBe(false);
    const r = await d.dispatch(sampleAlert);
    expect(r.attempts).toEqual([]);
  });
});
