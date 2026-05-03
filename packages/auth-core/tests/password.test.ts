// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  hashServiceAccountPassword,
  isPasswordHash,
  verifyServiceAccountPassword,
} from '../src/password.js';

describe('password', () => {
  it('hashes and verifies an argon2id password', async () => {
    const h = await hashServiceAccountPassword('correct-horse-battery-staple');
    expect(isPasswordHash(h)).toBe(true);
    expect(await verifyServiceAccountPassword(h, 'correct-horse-battery-staple')).toBe(true);
    expect(await verifyServiceAccountPassword(h, 'wrong-password-attempt')).toBe(false);
  });

  it('rejects short passwords (under 16 chars) by policy', async () => {
    await expect(hashServiceAccountPassword('short')).rejects.toThrow();
  });

  it('verifyServiceAccountPassword returns false for non-argon2id strings', async () => {
    expect(await verifyServiceAccountPassword('not-a-hash', 'whatever')).toBe(false);
  });

  it('two hashes of the same input differ (random salt)', async () => {
    const a = await hashServiceAccountPassword('correct-horse-battery-staple');
    const b = await hashServiceAccountPassword('correct-horse-battery-staple');
    expect(a).not.toBe(b);
  });
});
