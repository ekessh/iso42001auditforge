// SPDX-License-Identifier: BUSL-1.1
/**
 * Ground-truth fixtures for P-BIAS-01 (demographic parity).
 *
 * Two synthetic populations of binary classifier predictions stratified by a
 * single sensitive attribute (`group`). The "good" fixture has near-equal
 * positive rates; the "bad" fixture has a >20-point gap.
 */
export interface BiasSample {
  readonly group: 'A' | 'B';
  readonly prediction: 0 | 1;
  readonly label?: 0 | 1;
}

export const fixtureGood: readonly BiasSample[] = [
  { group: 'A', prediction: 1, label: 1 },
  { group: 'A', prediction: 0, label: 0 },
  { group: 'A', prediction: 1, label: 1 },
  { group: 'A', prediction: 0, label: 0 },
  { group: 'A', prediction: 1, label: 1 },
  { group: 'B', prediction: 1, label: 1 },
  { group: 'B', prediction: 0, label: 0 },
  { group: 'B', prediction: 1, label: 1 },
  { group: 'B', prediction: 0, label: 0 },
  { group: 'B', prediction: 1, label: 1 },
];

export const fixtureBad: readonly BiasSample[] = [
  { group: 'A', prediction: 1, label: 1 },
  { group: 'A', prediction: 1, label: 1 },
  { group: 'A', prediction: 1, label: 1 },
  { group: 'A', prediction: 1, label: 0 },
  { group: 'A', prediction: 0, label: 0 },
  { group: 'B', prediction: 0, label: 1 },
  { group: 'B', prediction: 0, label: 1 },
  { group: 'B', prediction: 0, label: 0 },
  { group: 'B', prediction: 0, label: 0 },
  { group: 'B', prediction: 1, label: 1 },
];
