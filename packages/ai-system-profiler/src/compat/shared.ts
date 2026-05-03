// SPDX-License-Identifier: BUSL-1.1
// TODO(phase-1): switch to @auditforge/shared once available; this is a
// local-only shim mirroring its public surface so the package compiles
// standalone during Phase 2 development.

declare const __brand: unique symbol;

/** Phantom-typed brand for compile-time-only nominal types. */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type Uuid = string;
export type FirmId = Brand<Uuid, 'FirmId'>;
export type AuditorId = Brand<Uuid, 'AuditorId'>;
export type ClientId = Brand<Uuid, 'ClientId'>;
export type EngagementId = Brand<Uuid, 'EngagementId'>;
export type AiSystemId = Brand<Uuid, 'AiSystemId'>;
export type AiSystemVersionId = Brand<Uuid, 'AiSystemVersionId'>;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function brandedFromUuid<B extends string>(u: string): Brand<Uuid, B> {
  if (!isUuid(u)) throw new TypeError(`brandedFromUuid: not a UUID: ${u}`);
  return u as Brand<Uuid, B>;
}

// ------------------------- Result<T,E> -----------------------------------
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

// ------------------------- Errors ----------------------------------------
export class AuditForgeError extends Error {
  public readonly code: string;
  public readonly httpStatus: number;
  public readonly details: Readonly<Record<string, unknown>>;
  constructor(
    code: string,
    message: string,
    httpStatus: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = Object.freeze({ ...details });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
export class TenantViolation extends AuditForgeError {
  constructor(message = 'Tenant context violation', details: Record<string, unknown> = {}) {
    super('TENANT_VIOLATION', message, 403, details);
  }
}
export class NotFoundError extends AuditForgeError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', `${resource} not found${id ? `: ${id}` : ''}`, 404, { resource, id });
  }
}
export class ValidationError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}
export class ConflictError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CONFLICT', message, 409, details);
  }
}
export class ImporterError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('IMPORTER_ERROR', message, 422, details);
  }
}
export class ConfigurationError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CONFIGURATION_ERROR', message, 500, details);
  }
}

// ------------------------- Tenancy ---------------------------------------
import { z } from 'zod';
export const UuidSchema = z.string().uuid();
export const TenantContextSchema = z.object({
  firmId: UuidSchema,
  auditorId: UuidSchema.optional(),
  engagementId: UuidSchema.optional(),
});
export type TenantContext = z.infer<typeof TenantContextSchema>;
