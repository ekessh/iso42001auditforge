// SPDX-License-Identifier: BUSL-1.1
export const fixtureGood = [
  { group: 'A', probability: 0.1, label: 0 },
  { group: 'A', probability: 0.2, label: 0 },
  { group: 'A', probability: 0.8, label: 1 },
  { group: 'A', probability: 0.9, label: 1 },
  { group: 'B', probability: 0.15, label: 0 },
  { group: 'B', probability: 0.25, label: 0 },
  { group: 'B', probability: 0.85, label: 1 },
  { group: 'B', probability: 0.95, label: 1 },
] as const;

export const fixtureBad = [
  { group: 'A', probability: 0.1, label: 0 },
  { group: 'A', probability: 0.15, label: 0 },
  { group: 'A', probability: 0.85, label: 1 },
  { group: 'A', probability: 0.9, label: 1 },
  // Group B is mis-calibrated: high confidence but wrong outcomes
  { group: 'B', probability: 0.9, label: 0 },
  { group: 'B', probability: 0.95, label: 0 },
  { group: 'B', probability: 0.1, label: 1 },
  { group: 'B', probability: 0.05, label: 1 },
] as const;
