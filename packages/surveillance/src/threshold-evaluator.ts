// SPDX-License-Identifier: BUSL-1.1
import { ValidationError } from '@auditforge/shared';
import {
  type ComparisonOp,
  type Severity,
  type SurveillanceAlert,
  type TelemetryPayload,
  type Threshold,
} from './domain.js';

/**
 * ThresholdEvaluator — rolling-window evaluator with hysteresis.
 *
 * Each (thresholdId, streamId) gets its own state machine:
 *   IDLE -> ARMED (after `enterSamples` consecutive breach samples)
 *   ARMED -> IDLE (after `exitSamples` consecutive non-breach samples)
 *
 * On the IDLE -> ARMED transition we emit a SurveillanceAlert; on subsequent
 * breach samples while ARMED we do NOT re-fire, preventing alert flap.
 * Returning to IDLE simply re-arms for the next event.
 */

interface EvalState {
  threshold: Threshold;
  /** Most recent values (for windowSize debugging / future analytics). */
  window: number[];
  consecutiveBreach: number;
  consecutiveOk: number;
  armed: boolean;
}

export interface ThresholdEvaluatorOptions {
  /** Generates alert ids; tests inject a deterministic counter. */
  newAlertId?: () => string;
  /** Returns ISO timestamp for `raisedAt`. Tests inject a fake clock. */
  now?: () => string;
}

function compare(op: ComparisonOp, value: number, boundary: number): boolean {
  switch (op) {
    case 'gt':
      return value > boundary;
    case 'gte':
      return value >= boundary;
    case 'lt':
      return value < boundary;
    case 'lte':
      return value <= boundary;
  }
}

function selectMetricNumber(
  payload: TelemetryPayload,
  selector: string,
): number | undefined {
  const body = payload.metric as unknown as Record<string, unknown>;
  const v = body[selector];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

let counter = 0;
const defaultAlertId = (): string => {
  counter += 1;
  return `alert_${Date.now()}_${counter}`;
};

export class ThresholdEvaluator {
  private readonly states = new Map<string, EvalState>();
  private readonly newAlertId: () => string;
  private readonly now: () => string;

  constructor(opts: ThresholdEvaluatorOptions = {}) {
    this.newAlertId = opts.newAlertId ?? defaultAlertId;
    this.now = opts.now ?? (() => new Date().toISOString());
  }

  /** Register or replace a threshold. */
  register(threshold: Threshold): void {
    if (
      threshold.warning !== undefined &&
      ((threshold.op === 'gt' || threshold.op === 'gte') &&
        threshold.warning > threshold.critical)
    ) {
      throw new ValidationError('warning must be <= critical for gt/gte op');
    }
    if (
      threshold.warning !== undefined &&
      ((threshold.op === 'lt' || threshold.op === 'lte') &&
        threshold.warning < threshold.critical)
    ) {
      throw new ValidationError('warning must be >= critical for lt/lte op');
    }
    const key = this.key(threshold.thresholdId, threshold.streamId);
    const prior = this.states.get(key);
    this.states.set(key, {
      threshold,
      window: prior?.window ?? [],
      consecutiveBreach: prior?.consecutiveBreach ?? 0,
      consecutiveOk: prior?.consecutiveOk ?? 0,
      armed: prior?.armed ?? false,
    });
  }

  remove(thresholdId: string, streamId: string): void {
    this.states.delete(this.key(thresholdId, streamId));
  }

  /**
   * Evaluate one telemetry payload against all registered thresholds for its
   * stream. Returns any newly-raised alerts.
   */
  evaluate(payload: TelemetryPayload): SurveillanceAlert[] {
    const out: SurveillanceAlert[] = [];
    for (const state of this.states.values()) {
      const t = state.threshold;
      if (t.streamId !== payload.streamId) continue;
      if (t.tenantId !== payload.tenantId) continue;
      if (t.metricType !== payload.metric.type) continue;
      const value = selectMetricNumber(payload, t.metricSelector);
      if (value === undefined) continue;

      // Maintain rolling window for analytics (capped to windowSize)
      state.window.push(value);
      if (state.window.length > t.windowSize) state.window.shift();

      // Determine current breach severity (critical wins over warning).
      let severity: Severity = 'info';
      let boundary = t.critical;
      if (compare(t.op, value, t.critical)) {
        severity = 'critical';
        boundary = t.critical;
      } else if (t.warning !== undefined && compare(t.op, value, t.warning)) {
        severity = 'warning';
        boundary = t.warning;
      }

      const isBreach = severity !== 'info';
      if (isBreach) {
        state.consecutiveBreach += 1;
        state.consecutiveOk = 0;
      } else {
        state.consecutiveOk += 1;
        state.consecutiveBreach = 0;
      }

      // State transitions
      if (!state.armed && state.consecutiveBreach >= t.enterSamples) {
        state.armed = true;
        out.push({
          alertId: this.newAlertId(),
          tenantId: t.tenantId,
          streamId: t.streamId,
          thresholdId: t.thresholdId,
          severity,
          metricType: t.metricType,
          observedValue: value,
          boundary,
          op: t.op,
          raisedAt: this.now(),
          context: {
            selector: t.metricSelector,
            consecutiveBreach: state.consecutiveBreach,
            windowSize: state.window.length,
            payloadId: payload.id,
          },
        });
      } else if (state.armed && state.consecutiveOk >= t.exitSamples) {
        state.armed = false;
      }
    }
    return out;
  }

  /** For tests / observability. */
  isArmed(thresholdId: string, streamId: string): boolean {
    const s = this.states.get(this.key(thresholdId, streamId));
    return s?.armed ?? false;
  }

  windowSnapshot(thresholdId: string, streamId: string): readonly number[] {
    const s = this.states.get(this.key(thresholdId, streamId));
    return s ? [...s.window] : [];
  }

  private key(thresholdId: string, streamId: string): string {
    return `${thresholdId} ${streamId}`;
  }
}
