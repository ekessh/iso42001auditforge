// SPDX-License-Identifier: BUSL-1.1
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

export const httpRequests = new Counter({
  name: 'auditforge_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status', 'firm'] as const,
  registers: [metricsRegistry],
});

export const httpLatencyMs = new Histogram({
  name: 'auditforge_http_request_duration_ms',
  help: 'HTTP request duration in ms',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200],
  registers: [metricsRegistry],
});

export const ledgerEvents = new Counter({
  name: 'auditforge_ledger_events_total',
  help: 'Audit ledger events emitted',
  labelNames: ['type', 'entity', 'firm'] as const,
  registers: [metricsRegistry],
});
