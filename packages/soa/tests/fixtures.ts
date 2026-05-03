// SPDX-License-Identifier: BUSL-1.1
let counter = 0;
export function makeIdFactory(): () => string {
  counter = 0;
  return () => {
    counter += 1;
    const hex = counter.toString(16).padStart(12, '0');
    return `00000000-0000-4000-8000-${hex}`;
  };
}

export const FIXED_NOW = '2026-05-03T12:00:00.000Z';
export const fixedNow = (): string => FIXED_NOW;

export const FIRM_ID = '00000000-0000-4000-8000-000000000001';
export const ENGAGEMENT_ID = '00000000-0000-4000-8000-000000000002';
export const REVIEWER_ID = '00000000-0000-4000-8000-000000000003';
