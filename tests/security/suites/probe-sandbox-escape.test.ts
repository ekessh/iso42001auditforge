// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

const ALLOWLIST = ['inference.auditee.example', 'auditforge-internal'];

function allowEgress(host: string): boolean {
  return ALLOWLIST.includes(host);
}

const FORBIDDEN = [
  '169.254.169.254', 'metadata.google.internal', '127.0.0.1', '::1', 'localhost',
  'evil.example', '0.0.0.0', '10.0.0.1', '192.168.1.1',
];

describe('probe sandbox egress', () => {
  it.each(FORBIDDEN)('blocks egress to %s', (host) => {
    expect(allowEgress(host)).toBe(false);
  });
  it.each(ALLOWLIST)('allows egress to %s', (host) => {
    expect(allowEgress(host)).toBe(true);
  });
});
