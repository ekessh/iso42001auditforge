// SPDX-License-Identifier: BUSL-1.1
import { z } from 'zod';

export const SamplingMethodSchema = z.enum([
  'random',
  'judgmental',
  'stratified',
  'risk_based',
  'systematic',
  'mus',
]);
export type SamplingMethod = z.infer<typeof SamplingMethodSchema>;

export function isProbabilisticMethod(m: SamplingMethod): boolean {
  return (
    m === 'random' ||
    m === 'stratified' ||
    m === 'risk_based' ||
    m === 'systematic' ||
    m === 'mus'
  );
}
