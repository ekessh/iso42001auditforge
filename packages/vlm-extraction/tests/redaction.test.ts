// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { redactPiiDeep, redactPiiInString } from '../src/redaction.js';

describe('redaction', () => {
  it('redacts email addresses', () => {
    expect(redactPiiInString('contact alice@x.com')).toBe('contact [REDACTED_EMAIL]');
  });
  it('redacts SSNs', () => {
    expect(redactPiiInString('SSN 555-12-3456')).toContain('[REDACTED_SSN]');
  });
  it('redacts phone numbers', () => {
    expect(redactPiiInString('call +1 555 123 9876')).toContain('[REDACTED_PHONE]');
  });
  it('walks objects and arrays', () => {
    const out = redactPiiDeep({ a: 'a@b.com', b: ['c@d.com', { x: 'e@f.com' }] });
    expect(JSON.stringify(out)).not.toContain('a@b.com');
    expect(JSON.stringify(out)).not.toContain('c@d.com');
    expect(JSON.stringify(out)).not.toContain('e@f.com');
  });
  it('passes through numbers and booleans', () => {
    expect(redactPiiDeep(42)).toBe(42);
    expect(redactPiiDeep(true)).toBe(true);
    expect(redactPiiDeep(null)).toBe(null);
  });
});
