// SPDX-License-Identifier: BUSL-1.1
import argon2 from 'argon2';

export const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashServiceAccountPassword(plain: string): Promise<string> {
  if (plain.length < 16) {
    throw new RangeError('service-account passwords must be at least 16 chars');
  }
  return argon2.hash(plain, PASSWORD_HASH_OPTIONS);
}

export async function verifyServiceAccountPassword(
  hashed: string,
  plain: string,
): Promise<boolean> {
  if (!hashed.startsWith('$argon2id$')) return false;
  return argon2.verify(hashed, plain);
}

export function isPasswordHash(s: string): boolean {
  return s.startsWith('$argon2id$');
}
