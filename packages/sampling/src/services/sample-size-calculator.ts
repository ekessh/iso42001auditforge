// SPDX-License-Identifier: BUSL-1.1
import { SchemeRegistry, RISK_WEIGHTED_OVERLAY } from './rules.js';

export interface SizeBounds {
  min: number;
  max: number;
}

export interface CalculateInput {
  /** Population size N. */
  N: number;
  /** Scheme rule id (defaults to `default-sqrt`). */
  ruleId?: string;
  /** Optional override registry (e.g. for tests / CB-specific rules). */
  registry?: SchemeRegistry;
  /** Optional bounds clamping after rule + overlay. */
  bounds?: SizeBounds;
  /** Average risk score in [0, 100] for risk-weighted overlay. */
  avgRiskScore?: number;
  /** Whether to apply the risk-weighted overlay multiplier on top of `ruleId`. */
  applyRiskOverlay?: boolean;
}

export interface CalculateOutput {
  size: number;
  ruleId: string;
  baseSize: number;
  overlayMultiplier: number;
  clamped: boolean;
}

export class SampleSizeCalculator {
  private readonly registry: SchemeRegistry;

  constructor(registry?: SchemeRegistry) {
    this.registry = registry ?? SchemeRegistry.defaultRegistry();
  }

  calculate(input: CalculateInput): CalculateOutput {
    const N = input.N;
    if (!Number.isInteger(N) || N < 0)
      throw new Error('SampleSizeCalculator: N must be a non-negative integer');

    const registry = input.registry ?? this.registry;
    const ruleId = input.ruleId ?? 'default-sqrt';
    const rule = registry.get(ruleId);

    const baseSize = rule.size(N);

    // Risk overlay multiplier: 1 + (avgRiskScore/100) * 0.5 → range [1.0, 1.5]
    let overlayMultiplier = 1;
    if (input.applyRiskOverlay) {
      const r = input.avgRiskScore ?? 0;
      if (r < 0 || r > 100)
        throw new Error(
          'SampleSizeCalculator: avgRiskScore must be in [0, 100]',
        );
      overlayMultiplier = 1 + (r / 100) * 0.5;
    }

    let size = Math.ceil(baseSize * overlayMultiplier);

    // Hard cap: cannot sample more than population.
    if (size > N) size = N;

    // Optional auditor-supplied bounds, but only when N >= bounds.min.
    let clamped = false;
    if (input.bounds) {
      const { min, max } = input.bounds;
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min)
        throw new Error('SampleSizeCalculator: invalid bounds');
      if (size < min && N >= min) {
        size = min;
        clamped = true;
      }
      if (size > max) {
        size = max;
        clamped = true;
      }
    }

    // Reference the overlay rule explicitly so it cannot be tree-shaken.
    void RISK_WEIGHTED_OVERLAY.id;

    return { size, ruleId, baseSize, overlayMultiplier, clamped };
  }
}
