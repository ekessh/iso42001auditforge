// SPDX-License-Identifier: BUSL-1.1
export const fixtureGood = [
  { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
] as const;

export const fixtureBad = [
  { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 0, noiseLevel: 0.1 },
  { baselineCorrect: 1, noisyCorrect: 1, noiseLevel: 0.1 },
] as const;
