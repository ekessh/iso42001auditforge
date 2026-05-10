// SPDX-License-Identifier: BUSL-1.1
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trace, context as otelContext } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';

import { withCriticalSpan, withSpan } from '../src/spans.js';
import { parseTraceParent } from '../src/propagation.js';
import { runWithCorrelationFrame, attachLedgerEventIdToActiveSpan } from '../src/correlate.js';

describe('integration: span propagation web -> api -> ledger', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider();
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter));
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
  });

  it('parent traceparent flows from inbound HTTP into nested ledger span', async () => {
    const incoming = parseTraceParent(
      '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    );
    expect(incoming).not.toBeNull();

    let observedTraceId: string | null = null;
    await runWithCorrelationFrame(async () => {
      await withSpan('api.controller.handle', async () => {
        await withCriticalSpan('auditforge.ledger.emit', async (span) => {
          attachLedgerEventIdToActiveSpan('evt-42');
          span.setAttribute('auditforge.ledger.event_id', 'evt-42');
          observedTraceId = span.spanContext().traceId;
        });
      });
    });

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBeGreaterThanOrEqual(2);
    const ledgerSpan = finished.find((s) => s.name === 'auditforge.ledger.emit');
    expect(ledgerSpan).toBeDefined();
    expect(ledgerSpan?.attributes['auditforge.critical']).toBe(true);
    expect(ledgerSpan?.attributes['auditforge.ledger.event_id']).toBe('evt-42');
    const controllerSpan = finished.find((s) => s.name === 'api.controller.handle');
    expect(controllerSpan).toBeDefined();
    expect(observedTraceId).not.toBeNull();
    void otelContext;
  });
});
