// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';

import { createLogger, DEFAULT_REDACT_PATHS } from '../src/logger.js';

interface CapturedLine {
  msg: string;
  [k: string]: unknown;
}

function captureLines(): { lines: CapturedLine[]; write: (chunk: string) => void } {
  const lines: CapturedLine[] = [];
  return {
    lines,
    write: (chunk: string): void => {
      const trimmed = chunk.trim();
      if (trimmed.length === 0) return;
      for (const part of trimmed.split('\n')) {
        if (part.length === 0) continue;
        lines.push(JSON.parse(part) as CapturedLine);
      }
    },
  };
}

describe('createLogger', () => {
  it('redacts authorization headers, jwt, signature, and presigned urls by default', () => {
    const cap = captureLines();
    const logger = createLogger({
      serviceName: 'test',
      destination: { write: cap.write },
      disableTraceMixin: true,
    });

    logger.info(
      {
        req: {
          headers: {
            authorization: 'Bearer abc123',
            cookie: 'session=top-secret',
          },
        },
        signature: 'MEUCIQDxyz',
        jwt: 'eyJhbGciOi.J...',
        presignedUrl: 'https://s3.example/?X-Amz-Signature=abc',
        prompt: 'do not leak this prompt',
        completion: 'do not leak this completion',
        nested: { password: 'pw', secret: 'sk', apiKey: 'ak' },
      },
      'request',
    );

    expect(cap.lines).toHaveLength(1);
    const line = cap.lines[0]!;
    const reqHeaders = (line['req'] as { headers: Record<string, string> }).headers;
    expect(reqHeaders.authorization).toBe('[REDACTED]');
    expect(reqHeaders.cookie).toBe('[REDACTED]');
    expect(line['signature']).toBe('[REDACTED]');
    expect(line['jwt']).toBe('[REDACTED]');
    expect(line['presignedUrl']).toBe('[REDACTED]');
    expect(line['prompt']).toBe('[REDACTED]');
    expect(line['completion']).toBe('[REDACTED]');
    const nested = line['nested'] as Record<string, string>;
    expect(nested.password).toBe('[REDACTED]');
    expect(nested.secret).toBe('[REDACTED]');
    expect(nested.apiKey).toBe('[REDACTED]');
  });

  it('exposes the default redact list as a stable readonly array', () => {
    expect(DEFAULT_REDACT_PATHS).toContain('req.headers.authorization');
    expect(DEFAULT_REDACT_PATHS).toContain('signature');
    expect(DEFAULT_REDACT_PATHS).toContain('prompt');
    expect(DEFAULT_REDACT_PATHS).toContain('presignedUrl');
  });

  it('writes service / environment as base fields and accepts an extra redact path', () => {
    const cap = captureLines();
    const logger = createLogger({
      serviceName: 'auditforge-api',
      serviceVersion: '1.2.3',
      environment: 'staging',
      extraRedactPaths: ['custom.field'],
      destination: { write: cap.write },
      disableTraceMixin: true,
    });
    logger.info({ custom: { field: 'sensitive' } }, 'hi');

    const line = cap.lines[0]!;
    expect(line['service']).toBe('auditforge-api');
    expect(line['service_version']).toBe('1.2.3');
    expect(line['environment']).toBe('staging');
    expect((line['custom'] as Record<string, string>).field).toBe('[REDACTED]');
  });
});
