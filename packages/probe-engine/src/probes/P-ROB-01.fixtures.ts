// SPDX-License-Identifier: BUSL-1.1
export const fixtureGood = [
  { cleanCorrect: 1, perturbedCorrect: 1 },
  { cleanCorrect: 1, perturbedCorrect: 1 },
  { cleanCorrect: 1, perturbedCorrect: 1 },
  { cleanCorrect: 1, perturbedCorrect: 0 },
  { cleanCorrect: 1, perturbedCorrect: 1 },
] as const;

export const fixtureBad = [
  { cleanCorrect: 1, perturbedCorrect: 0 },
  { cleanCorrect: 1, perturbedCorrect: 0 },
  { cleanCorrect: 1, perturbedCorrect: 0 },
  { cleanCorrect: 1, perturbedCorrect: 1 },
  { cleanCorrect: 1, perturbedCorrect: 0 },
] as const;
