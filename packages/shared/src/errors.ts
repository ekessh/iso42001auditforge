// SPDX-License-Identifier: BUSL-1.1
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

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      httpStatus: this.httpStatus,
      details: this.details,
    };
  }
}

export class TenantViolation extends AuditForgeError {
  constructor(message = 'Tenant context violation', details: Record<string, unknown> = {}) {
    super('TENANT_VIOLATION', message, 403, details);
  }
}

export class AuditLedgerCorruption extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('LEDGER_CORRUPTION', message, 500, details);
  }
}

export class ProbeBudgetExceeded extends AuditForgeError {
  constructor(message = 'Engagement probe budget exceeded', details: Record<string, unknown> = {}) {
    super('PROBE_BUDGET_EXCEEDED', message, 402, details);
  }
}

export class AuthenticationError extends AuditForgeError {
  constructor(message = 'Authentication failed', details: Record<string, unknown> = {}) {
    super('AUTHENTICATION_FAILED', message, 401, details);
  }
}

export class AuthorizationError extends AuditForgeError {
  constructor(message = 'Authorization denied', details: Record<string, unknown> = {}) {
    super('AUTHORIZATION_DENIED', message, 403, details);
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

export class ImmutableViolation extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('IMMUTABLE_VIOLATION', message, 423, details);
  }
}

export class StateMachineError extends AuditForgeError {
  constructor(from: string, to: string, details: Record<string, unknown> = {}) {
    super(
      'STATE_TRANSITION_INVALID',
      `Invalid state transition: ${from} -> ${to}`,
      409,
      { from, to, ...details },
    );
  }
}

export class ConsentRequiredError extends AuditForgeError {
  constructor(action: string, details: Record<string, unknown> = {}) {
    super('CONSENT_REQUIRED', `Consent required for: ${action}`, 412, { action, ...details });
  }
}

export class ConfigurationError extends AuditForgeError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('CONFIGURATION_ERROR', message, 500, details);
  }
}
