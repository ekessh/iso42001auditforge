// SPDX-License-Identifier: BUSL-1.1

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Readonly<Record<string, unknown>>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = Object.freeze({ ...details });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ApiNotFoundError extends ApiClientError {
  constructor(resource: string, id?: string) {
    super('NOT_FOUND', `${resource} not found${id ? `: ${id}` : ''}`, 404, { resource, id });
    this.name = 'ApiNotFoundError';
  }
}

export class ApiUnauthorizedError extends ApiClientError {
  constructor(message = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
    this.name = 'ApiUnauthorizedError';
  }
}

export class ApiValidationError extends ApiClientError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ApiValidationError';
  }
}

export class ApiNetworkError extends ApiClientError {
  constructor(message: string, cause?: unknown) {
    super('NETWORK_ERROR', message, 0, cause ? { cause: String(cause) } : {});
    this.name = 'ApiNetworkError';
  }
}
