// SPDX-License-Identifier: BUSL-1.1
import { HttpStatus } from '@nestjs/common';

export class DomainError extends Error {
  readonly type: string;
  readonly status: HttpStatus;
  readonly title: string;
  readonly detail: string;
  readonly extras: Record<string, unknown> | undefined;

  constructor(opts: {
    type: string;
    status: HttpStatus;
    title: string;
    detail: string;
    extras?: Record<string, unknown>;
  }) {
    super(opts.detail);
    this.name = 'DomainError';
    this.type = opts.type;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.extras = opts.extras;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super({
      type: 'https://auditforge.dev/errors/not-found',
      status: HttpStatus.NOT_FOUND,
      title: 'Resource not found',
      detail: `${entity} ${id} not found`,
      extras: { entity, id },
    });
  }
}

export class ForbiddenError extends DomainError {
  constructor(reason: string) {
    super({
      type: 'https://auditforge.dev/errors/forbidden',
      status: HttpStatus.FORBIDDEN,
      title: 'Forbidden',
      detail: reason,
    });
  }
}

export class TenantViolationError extends DomainError {
  constructor() {
    super({
      type: 'https://auditforge.dev/errors/tenant-violation',
      status: HttpStatus.NOT_FOUND,
      title: 'Resource not found',
      detail: 'The requested resource was not found',
    });
  }
}

export class UnauthorizedError extends DomainError {
  constructor(reason = 'Authentication required') {
    super({
      type: 'https://auditforge.dev/errors/unauthorized',
      status: HttpStatus.UNAUTHORIZED,
      title: 'Unauthorized',
      detail: reason,
    });
  }
}

export class ConflictError extends DomainError {
  constructor(detail: string, extras?: Record<string, unknown>) {
    super({
      type: 'https://auditforge.dev/errors/conflict',
      status: HttpStatus.CONFLICT,
      title: 'Conflict',
      detail,
      extras: extras ?? {},
    });
  }
}

export class ValidationError extends DomainError {
  constructor(detail: string, extras?: Record<string, unknown>) {
    super({
      type: 'https://auditforge.dev/errors/validation',
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      title: 'Validation failed',
      detail,
      extras: extras ?? {},
    });
  }
}

export class RateLimitedError extends DomainError {
  constructor() {
    super({
      type: 'https://auditforge.dev/errors/rate-limited',
      status: HttpStatus.TOO_MANY_REQUESTS,
      title: 'Too many requests',
      detail: 'Rate limit exceeded',
    });
  }
}

export class SigningRequiredError extends DomainError {
  constructor() {
    super({
      type: 'https://auditforge.dev/errors/signing-required',
      status: HttpStatus.UNAUTHORIZED,
      title: 'Signed action required',
      detail: 'This endpoint requires a WebAuthn-attested signed request',
    });
  }
}
