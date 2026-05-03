// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  EmailSchema,
  IsoDateSchema,
  Sha256HexSchema,
  SemverSchema,
  TenantContextSchema,
  UlidSchema,
  UuidSchema,
} from '../src/validators.js';

describe('validators', () => {
  it('UuidSchema accepts canonical UUIDs', () => {
    expect(UuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success).toBe(true);
  });

  it('UuidSchema rejects malformed strings', () => {
    expect(UuidSchema.safeParse('nope').success).toBe(false);
  });

  it('EmailSchema lowercases + trims', () => {
    const r = EmailSchema.safeParse('  Foo@Example.COM ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('foo@example.com');
  });

  it('EmailSchema rejects invalid', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });

  it('UlidSchema accepts canonical', () => {
    expect(UlidSchema.safeParse('01ARZ3NDEKTSV4RRFFQ69G5FAV').success).toBe(true);
  });

  it('UlidSchema rejects lowercase or wrong length', () => {
    expect(UlidSchema.safeParse('01arz3ndektsv4rrffq69g5fav').success).toBe(false);
    expect(UlidSchema.safeParse('01ARZ3NDEKTSV4RRFFQ69G5FA').success).toBe(false);
  });

  it('IsoDateSchema accepts ISO timestamp', () => {
    expect(IsoDateSchema.safeParse('2026-05-03T12:00:00Z').success).toBe(true);
  });

  it('IsoDateSchema rejects gibberish', () => {
    expect(IsoDateSchema.safeParse('not-a-date').success).toBe(false);
  });

  it('Sha256HexSchema accepts 64 hex chars', () => {
    expect(Sha256HexSchema.safeParse('a'.repeat(64)).success).toBe(true);
    expect(Sha256HexSchema.safeParse('A'.repeat(64)).success).toBe(false); // lowercase only
    expect(Sha256HexSchema.safeParse('a'.repeat(63)).success).toBe(false);
  });

  it('SemverSchema accepts canonical', () => {
    expect(SemverSchema.safeParse('1.2.3').success).toBe(true);
    expect(SemverSchema.safeParse('1.2.3-rc.1').success).toBe(true);
    expect(SemverSchema.safeParse('1.2').success).toBe(false);
  });

  it('TenantContextSchema requires firmId', () => {
    expect(TenantContextSchema.safeParse({}).success).toBe(false);
    expect(
      TenantContextSchema.safeParse({ firmId: '550e8400-e29b-41d4-a716-446655440000' }).success,
    ).toBe(true);
  });
});
