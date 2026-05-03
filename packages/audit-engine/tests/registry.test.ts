// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ConfigurationError, ValidationError } from '@auditforge/shared';
import { EventSchemaRegistry, createDefaultRegistry } from '../src/registry.js';

describe('EventSchemaRegistry', () => {
  it('register + get round-trip', () => {
    const r = new EventSchemaRegistry();
    r.register({ type: 'foo.bar', version: 1, schema: z.object({ x: z.number() }) });
    expect(r.get('foo.bar', 1)).toBeDefined();
    expect(r.get('foo.bar', 2)).toBeUndefined();
  });

  it('rejects duplicate registration', () => {
    const r = new EventSchemaRegistry();
    r.register({ type: 'a', version: 1, schema: z.object({}) });
    expect(() => r.register({ type: 'a', version: 1, schema: z.object({}) })).toThrow(
      ConfigurationError,
    );
  });

  it('validate rejects unknown types', () => {
    const r = new EventSchemaRegistry();
    expect(() => r.validate('unknown', 1, {})).toThrow(ValidationError);
  });

  it('validate rejects bad payloads', () => {
    const r = new EventSchemaRegistry();
    r.register({
      type: 'a',
      version: 1,
      schema: z.object({ x: z.number() }),
    });
    expect(() => r.validate('a', 1, { x: 'no' })).toThrow(ValidationError);
  });

  it('validate strips & normalises', () => {
    const r = new EventSchemaRegistry();
    r.register({
      type: 'a',
      version: 1,
      schema: z.object({ x: z.number() }),
    });
    const result = r.validate('a', 1, { x: 5 });
    expect(result).toEqual({ x: 5 });
  });

  it('default registry contains expected events', () => {
    const r = createDefaultRegistry();
    const types = r.list().map((d) => d.type);
    for (const t of [
      'engagement.created',
      'working_paper.created',
      'finding.opened',
      'evidence.uploaded',
      'probe.executed',
      'report.signed',
      'audit_file.frozen',
    ]) {
      expect(types).toContain(t);
    }
  });
});
