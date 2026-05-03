// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import {
  AuditForgeError,
  AuditLedgerCorruption,
  AuthenticationError,
  AuthorizationError,
  ConfigurationError,
  ConflictError,
  ConsentRequiredError,
  ImmutableViolation,
  NotFoundError,
  ProbeBudgetExceeded,
  StateMachineError,
  TenantViolation,
  ValidationError,
} from '../src/errors.js';

describe('errors', () => {
  it('TenantViolation defaults', () => {
    const e = new TenantViolation();
    expect(e.code).toBe('TENANT_VIOLATION');
    expect(e.httpStatus).toBe(403);
    expect(e).toBeInstanceOf(AuditForgeError);
    expect(e).toBeInstanceOf(Error);
  });

  it('NotFoundError formats id', () => {
    const e = new NotFoundError('Engagement', 'abc');
    expect(e.message).toContain('Engagement');
    expect(e.message).toContain('abc');
    expect(e.httpStatus).toBe(404);
  });

  it('StateMachineError captures from/to', () => {
    const e = new StateMachineError('draft', 'archived');
    expect(e.message).toContain('draft -> archived');
    expect(e.details).toMatchObject({ from: 'draft', to: 'archived' });
  });

  it('toJSON produces serialisable object', () => {
    const e = new ValidationError('bad', { field: 'x' });
    const json = e.toJSON();
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.details).toEqual({ field: 'x' });
  });

  it('details are frozen', () => {
    const e = new AuditLedgerCorruption('tamper', { eventId: '1' });
    expect(() => {
      (e.details as Record<string, unknown>).eventId = '2';
    }).toThrow();
  });

  it('all error classes set correct status codes', () => {
    expect(new AuthenticationError().httpStatus).toBe(401);
    expect(new AuthorizationError().httpStatus).toBe(403);
    expect(new ConflictError('x').httpStatus).toBe(409);
    expect(new ImmutableViolation('x').httpStatus).toBe(423);
    expect(new ConsentRequiredError('cloud-llm').httpStatus).toBe(412);
    expect(new ProbeBudgetExceeded().httpStatus).toBe(402);
    expect(new ConfigurationError('x').httpStatus).toBe(500);
  });
});
