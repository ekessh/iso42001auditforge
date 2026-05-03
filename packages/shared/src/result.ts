// SPDX-License-Identifier: BUSL-1.1
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = Error> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return !r.ok;
}

export function map<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> {
  return r.ok ? ok(f(r.value)) : r;
}

export function mapErr<T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> {
  return r.ok ? r : err(f(r.error));
}

export function flatMap<T, U, E>(
  r: Result<T, E>,
  f: (t: T) => Result<U, E>,
): Result<U, E> {
  return r.ok ? f(r.value) : r;
}

export function unwrap<T, E>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  throw r.error instanceof Error ? r.error : new Error(String(r.error));
}

export function unwrapOr<T, E>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

export async function fromPromise<T>(
  p: Promise<T>,
): Promise<Result<T, unknown>> {
  try {
    return ok(await p);
  } catch (e) {
    return err(e);
  }
}

export function tryCatch<T>(fn: () => T): Result<T, unknown> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e);
  }
}
