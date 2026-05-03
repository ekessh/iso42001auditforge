// SPDX-License-Identifier: Apache-2.0
/**
 * OpenTelemetry SDK initialiser.
 *
 * Single source of truth for AuditForge OTel configuration. Idempotent: a second call is a no-op.
 * Resource attributes are intentionally low-cardinality; raw tenant ids must NEVER be set as a
 * resource attribute (they would explode label cardinality on prom-bridged metrics).
 *
 * Per-tenant span attribution is set on individual spans via {@link withSpan}, not here.
 */
import {
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
  trace,
  type Tracer,
} from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter as HttpExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPTraceExporter as GrpcExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Sampler,
} from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

export interface InitOtelOptions {
  /** Service name used for the `service.name` resource attribute. */
  readonly serviceName: string;
  /** Service version (typically read from package.json) for `service.version`. */
  readonly serviceVersion?: string;
  /** Deployment environment: `production`, `staging`, `development`, `test`. */
  readonly environment?: string;
  /** OTLP collector endpoint, e.g. `http://otel-collector:4318`. When unset, OTel is not started. */
  readonly otlpEndpoint?: string;
  /**
   * Head sampling ratio in [0,1]. The actual sampler is `ParentBased(TraceIdRatioBased(rate))`,
   * which preserves upstream sampling decisions. Defaults to 0.1.
   */
  readonly sampler?: number;
  /** OTLP transport: `http` (default) or `grpc`. */
  readonly protocol?: 'http' | 'grpc';
  /**
   * Optional component label (`auditforge.component`). E.g. `api`, `worker`, `mcp-server`. Low cardinality.
   */
  readonly component?: string;
  /**
   * Hook called by the framework's onApplicationShutdown / onModuleDestroy lifecycle.
   * If provided, the SDK shutdown is registered with this hook instead of process signals.
   */
  readonly registerShutdownHook?: (handler: () => Promise<void>) => void;
  /** When true, log to stderr the SDK lifecycle. Defaults to false. */
  readonly debug?: boolean;
}

interface InternalState {
  sdk: NodeSDK | null;
  serviceName: string | null;
  ratio: number;
}

const state: InternalState = { sdk: null, serviceName: null, ratio: 0 };

/**
 * Initialises the OTel Node SDK. Idempotent and safe to call from multiple bootstrap paths.
 * Returns the configured tracer instance, or `null` when the SDK was not started (no endpoint).
 */
export function initOtel(opts: InitOtelOptions): Tracer | null {
  if (state.sdk !== null) {
    return trace.getTracer(state.serviceName ?? opts.serviceName);
  }
  if (!opts.otlpEndpoint || opts.otlpEndpoint.length === 0) {
    return null;
  }
  if (opts.debug === true) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
  }

  const ratio = clampRatio(opts.sampler ?? 0.1);
  const sampler: Sampler = new ParentBasedSampler({
    root: new TraceIdRatioBasedSampler(ratio),
  });

  const resourceAttrs: Record<string, string> = {
    [ATTR_SERVICE_NAME]: opts.serviceName,
  };
  if (opts.serviceVersion !== undefined) {
    resourceAttrs[ATTR_SERVICE_VERSION] = opts.serviceVersion;
  }
  if (opts.environment !== undefined) {
    resourceAttrs['deployment.environment'] = opts.environment;
  }
  if (opts.component !== undefined) {
    resourceAttrs['auditforge.component'] = opts.component;
  }
  const resource = new Resource(resourceAttrs);

  const traceExporter =
    opts.protocol === 'grpc'
      ? new GrpcExporter({ url: opts.otlpEndpoint })
      : new HttpExporter({ url: `${stripTrailingSlash(opts.otlpEndpoint)}/v1/traces` });

  const sdk = new NodeSDK({
    resource,
    sampler,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // High-noise / low-signal — disable by default.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // Explicitly enable the spans we care about most.
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
      }),
    ],
  });

  sdk.start();
  state.sdk = sdk;
  state.serviceName = opts.serviceName;
  state.ratio = ratio;

  const shutdownHandler = async (): Promise<void> => {
    await shutdownOtel();
  };
  if (opts.registerShutdownHook !== undefined) {
    opts.registerShutdownHook(shutdownHandler);
  } else {
    process.once('SIGTERM', () => {
      void shutdownHandler();
    });
    process.once('SIGINT', () => {
      void shutdownHandler();
    });
  }

  return trace.getTracer(opts.serviceName);
}

/**
 * Awaits a clean OTel SDK shutdown. After this returns, {@link initOtel} can be called again
 * (e.g. in tests) and will reinitialise the SDK.
 */
export async function shutdownOtel(): Promise<void> {
  const sdk = state.sdk;
  if (sdk === null) return;
  state.sdk = null;
  state.serviceName = null;
  await sdk.shutdown();
}

/** True when the SDK has been started successfully. */
export function isOtelStarted(): boolean {
  return state.sdk !== null;
}

/** Read-only view of the configured head sampling ratio. */
export function getSamplerRatio(): number {
  return state.ratio;
}

function clampRatio(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}
