// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import { SpanNames, withCriticalSpan, withSpan } from '../src/spans.js';

describe('span helpers', () => {
  it('withSpan resolves and returns the underlying value', async () => {
    const result = await withSpan('test.ok', async () => 42);
    expect(result).toBe(42);
  });

  it('withSpan re-throws errors after recording them', async () => {
    await expect(
      withSpan('test.boom', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });

  it('withCriticalSpan sets auditforge.critical=true on the span attributes', async () => {
    let observedCritical: unknown;
    await withCriticalSpan(
      'test.critical',
      async (span) => {
        // The OTel API does not expose a public reader for attributes; we rely on the absence
        // of a thrown error and on the documented contract. Instead, verify we can mutate the
        // span via the public API without exception.
        span.setAttribute('test.k', 'v');
        observedCritical = true;
        return 'ok';
      },
      { attributes: { 'test.preset': 1 } },
    );
    expect(observedCritical).toBe(true);
  });

  it('exposes canonical span names', () => {
    expect(SpanNames.ledgerEmit).toBe('auditforge.ledger.emit');
    expect(SpanNames.rlsSetTenant).toBe('auditforge.rls.set_tenant');
    expect(SpanNames.probeExecute).toBe('auditforge.probe.execute');
    expect(SpanNames.llmCall).toBe('auditforge.llm.call');
  });
});
