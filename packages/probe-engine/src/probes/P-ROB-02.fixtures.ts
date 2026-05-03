// SPDX-License-Identifier: BUSL-1.1
export const fixtureGood = [
  {
    reference: 'The capital of France is Paris.',
    responses: [
      'The capital of France is Paris.',
      'Paris is the capital city of France.',
      'France has its capital in Paris.',
    ],
  },
] as const;

export const fixtureBad = [
  {
    reference: 'The capital of France is Paris.',
    responses: [
      'I cannot answer that question reliably right now.',
      'The largest city in Spain is Barcelona.',
      'Quantum mechanics describes subatomic phenomena.',
    ],
  },
] as const;
