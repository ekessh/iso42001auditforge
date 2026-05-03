// SPDX-License-Identifier: BUSL-1.1

/**
 * Scheme rules drive the sample-size calculator. Each rule maps a population
 * size `N` to a recommended sample size `n`. The default `n = ceil(sqrt(N))`
 * follows ISO 19011-style spot-check guidance and IAF/MD-23 expectations for
 * AIMS audits.
 *
 * Rules are deliberately simple and pure (no I/O, no clock) so they can be
 * golden-tested.
 */
export interface SchemeRule {
  readonly id: string;
  readonly description: string;
  /** Compute n from N. Implementations MUST NOT clamp; clamping is the
   *  calculator's responsibility (so risk-overlay can multiply unclamped). */
  size(N: number): number;
}

const ceilSqrt = (N: number): number =>
  N <= 0 ? 0 : Math.ceil(Math.sqrt(N));

export const DEFAULT_SQRT: SchemeRule = {
  id: 'default-sqrt',
  description: 'n = ceil(sqrt(N)) — generic default per ISO 19011 guidance.',
  size: (N) => ceilSqrt(N),
};

export const ISO17021_LOW: SchemeRule = {
  id: 'iso17021-low-complexity',
  description: 'IAF/ISO 17021-1 low-complexity AIMS: max(3, ceil(sqrt(N)*0.8)).',
  size: (N) => (N <= 0 ? 0 : Math.max(3, Math.ceil(ceilSqrt(N) * 0.8))),
};

export const ISO17021_MEDIUM: SchemeRule = {
  id: 'iso17021-medium-complexity',
  description: 'IAF/ISO 17021-1 medium-complexity AIMS: ceil(sqrt(N)).',
  size: (N) => ceilSqrt(N),
};

export const ISO17021_HIGH: SchemeRule = {
  id: 'iso17021-high-complexity',
  description: 'IAF/ISO 17021-1 high-complexity AIMS: ceil(sqrt(N)*1.25).',
  size: (N) => (N <= 0 ? 0 : Math.ceil(ceilSqrt(N) * 1.25)),
};

export const IAF_MD23_AIMS_LOW: SchemeRule = {
  id: 'mdr-iaf-md23-aims-low',
  description: 'IAF MD 23 AIMS low-criticality: max(5, ceil(sqrt(N))).',
  size: (N) => (N <= 0 ? 0 : Math.max(5, ceilSqrt(N))),
};

export const IAF_MD23_AIMS_HIGH: SchemeRule = {
  id: 'mdr-iaf-md23-aims-high',
  description: 'IAF MD 23 AIMS high-criticality: max(8, ceil(sqrt(N)*1.5)).',
  size: (N) => (N <= 0 ? 0 : Math.max(8, Math.ceil(ceilSqrt(N) * 1.5))),
};

export const INCIDENT_POPULATION: SchemeRule = {
  id: 'incident-population',
  description:
    'Incidents are over-sampled: min(N, max(5, ceil(sqrt(N)*1.5))).',
  size: (N) =>
    N <= 0 ? 0 : Math.min(N, Math.max(5, Math.ceil(ceilSqrt(N) * 1.5))),
};

export const RISK_WEIGHTED_OVERLAY: SchemeRule = {
  id: 'risk-weighted-overlay',
  description:
    'Multiplier applied on top of base size: 1 + (avgRiskScore/100)*0.5.',
  // Overlay rules don't compute size standalone; calculator handles overlay.
  size: (N) => ceilSqrt(N),
};

const BUILTIN: ReadonlyArray<SchemeRule> = [
  DEFAULT_SQRT,
  ISO17021_LOW,
  ISO17021_MEDIUM,
  ISO17021_HIGH,
  IAF_MD23_AIMS_LOW,
  IAF_MD23_AIMS_HIGH,
  INCIDENT_POPULATION,
  RISK_WEIGHTED_OVERLAY,
];

export class SchemeRegistry {
  private readonly rules = new Map<string, SchemeRule>();

  constructor(initial: ReadonlyArray<SchemeRule> = BUILTIN) {
    for (const r of initial) this.rules.set(r.id, r);
  }

  register(rule: SchemeRule): void {
    if (this.rules.has(rule.id))
      throw new Error(`SchemeRegistry: duplicate rule id ${rule.id}`);
    this.rules.set(rule.id, rule);
  }

  get(id: string): SchemeRule {
    const r = this.rules.get(id);
    if (!r) throw new Error(`SchemeRegistry: unknown rule id ${id}`);
    return r;
  }

  has(id: string): boolean {
    return this.rules.has(id);
  }

  list(): ReadonlyArray<SchemeRule> {
    return Array.from(this.rules.values());
  }

  static defaultRegistry(): SchemeRegistry {
    return new SchemeRegistry();
  }
}

export const BUILTIN_RULE_COUNT = BUILTIN.length;
