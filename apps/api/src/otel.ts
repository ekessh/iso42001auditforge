// SPDX-License-Identifier: BUSL-1.1
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

let started = false;

export function startOtel(serviceName: string, otlpEndpoint?: string): void {
  if (started) return;
  if (!otlpEndpoint) return;
  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    })],
  });
  sdk.start();
  started = true;
  process.on('SIGTERM', () => { void sdk.shutdown(); });
}
