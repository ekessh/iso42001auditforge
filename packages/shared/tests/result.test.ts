// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  err,
  flatMap,
  fromPromise,
  isErr,
  isOk,
  map,
  mapErr,
  ok,
  tryCatch,
  unwrap,
  unwrapOr,
} from '../src/result.js';

describe('Result', () => {
  it('ok / err type guards', () => {
    const a = ok(1);
    const b = err('boom');
    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);
    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);
  });

  it('map transforms ok', () => {
    expect(map(ok(2), (n) => n * 3)).toEqual({ ok: true, value: 6 });
    expect(map(err('e'), (n: number) => n * 3)).toEqual({ ok: false, error: 'e' });
  });

  it('mapErr transforms err', () => {
    expect(mapErr(err('e'), (e) => e.toUpperCase())).toEqual({ ok: false, error: 'E' });
    expect(mapErr(ok(1), (e: string) => e.toUpperCase())).toEqual({ ok: true, value: 1 });
  });

  it('flatMap chains', () => {
    const safeDiv = (a: number, b: number) =>
      b === 0 ? err('div0') : ok(a / b);
    expect(flatMap(ok(10), (n) => safeDiv(n, 2))).toEqual({ ok: true, value: 5 });
    expect(flatMap(ok(10), (n) => safeDiv(n, 0))).toEqual({ ok: false, error: 'div0' });
  });

  it('unwrap / unwrapOr', () => {
    expect(unwrap(ok(7))).toBe(7);
    expect(() => unwrap(err(new Error('boom')))).toThrow('boom');
    expect(unwrapOr(err('x'), 99)).toBe(99);
  });

  it('fromPromise wraps resolve / reject', async () => {
    const okRes = await fromPromise(Promise.resolve(1));
    expect(okRes).toEqual({ ok: true, value: 1 });
    const errRes = await fromPromise(Promise.reject(new Error('x')));
    expect(errRes.ok).toBe(false);
  });

  it('tryCatch wraps throwing functions', () => {
    expect(tryCatch(() => 1)).toEqual({ ok: true, value: 1 });
    const r = tryCatch(() => {
      throw new Error('boom');
    });
    expect(r.ok).toBe(false);
  });
});
