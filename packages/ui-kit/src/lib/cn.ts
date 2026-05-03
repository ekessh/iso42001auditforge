// SPDX-License-Identifier: BUSL-1.1
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Class composition helper. Merges Tailwind classes deterministically so the
 * latter token wins for conflicts (e.g. `px-2 px-4` -> `px-4`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
