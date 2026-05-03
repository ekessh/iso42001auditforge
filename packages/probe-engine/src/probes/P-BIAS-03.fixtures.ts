// SPDX-License-Identifier: BUSL-1.1
export const fixtureGood = [
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 0 },
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 0 },
  { group: 'B', prediction: 1 },
  { group: 'B', prediction: 1 },
  { group: 'B', prediction: 0 },
  { group: 'B', prediction: 1 },
  { group: 'B', prediction: 0 },
] as const;

export const fixtureBad = [
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 1 },
  { group: 'A', prediction: 0 },
  { group: 'B', prediction: 0 },
  { group: 'B', prediction: 0 },
  { group: 'B', prediction: 0 },
  { group: 'B', prediction: 1 },
  { group: 'B', prediction: 0 },
] as const;
