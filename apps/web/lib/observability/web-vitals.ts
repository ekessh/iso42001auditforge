// SPDX-License-Identifier: BUSL-1.1
/**
 * RUM web-vitals collector. Buffers samples and ships them to the API in batches via the
 * Beacon API (so they survive page-unload). Falls back to fetch-keepalive when navigator.sendBeacon
 * is unavailable.
 *
 * WHY a buffer + flush instead of one-shot per metric: web-vitals emits up to ~6 metrics per page;
 * batching cuts request count and improves the chance that the browser actually sends them on
 * unload.
 */
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from 'web-vitals';

import {
  webVitalSampleSchema,
  type WebVitalName,
  type WebVitalSample,
  type WebVitalsBatch,
} from './types.js';

export interface WebVitalsClientOptions {
  readonly endpoint?: string;
  readonly maxBatch?: number;
  readonly flushIntervalMs?: number;
  readonly sessionId?: string;
  readonly traceIdProvider?: () => string | undefined;
  readonly onSampleDropped?: (reason: string, sample: unknown) => void;
}

const DEFAULT_OPTIONS: Required<Omit<WebVitalsClientOptions, 'sessionId' | 'traceIdProvider' | 'onSampleDropped'>> = {
  endpoint: '/v1/observability/web-vitals',
  maxBatch: 16,
  flushIntervalMs: 8000,
};

interface WebVitalsClient {
  flush: () => Promise<void>;
  stop: () => void;
}

export function startWebVitalsClient(opts: WebVitalsClientOptions = {}): WebVitalsClient {
  const cfg = {
    ...DEFAULT_OPTIONS,
    ...(opts.endpoint !== undefined ? { endpoint: opts.endpoint } : {}),
    ...(opts.maxBatch !== undefined ? { maxBatch: opts.maxBatch } : {}),
    ...(opts.flushIntervalMs !== undefined ? { flushIntervalMs: opts.flushIntervalMs } : {}),
  };
  const buffer: WebVitalSample[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const enqueue = (metric: Metric): void => {
    if (stopped) return;
    const name = metric.name as WebVitalName;
    const sample: WebVitalSample = {
      name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      pageUrl: window.location.href,
      pagePath: window.location.pathname,
      occurredAt: new Date().toISOString(),
      ...(metric.navigationType !== undefined ? { navigationType: metric.navigationType } : {}),
      ...(opts.sessionId !== undefined ? { sessionId: opts.sessionId } : {}),
      ...(opts.traceIdProvider !== undefined && opts.traceIdProvider() !== undefined
        ? { traceId: opts.traceIdProvider()! }
        : {}),
      ...(typeof navigator !== 'undefined' ? { userAgent: navigator.userAgent.slice(0, 512) } : {}),
    };
    const validated = webVitalSampleSchema.safeParse(sample);
    if (!validated.success) {
      opts.onSampleDropped?.('invalid', sample);
      return;
    }
    buffer.push(validated.data);
    if (buffer.length >= cfg.maxBatch) {
      void flush();
    }
  };

  const flush = async (): Promise<void> => {
    if (buffer.length === 0) return;
    const batch: WebVitalsBatch = { samples: buffer.splice(0, buffer.length) };
    const body = JSON.stringify(batch);
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        if (navigator.sendBeacon(cfg.endpoint, blob)) return;
      }
      await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
        credentials: 'same-origin',
      });
    } catch (e) {
      opts.onSampleDropped?.('network', e);
    }
  };

  onCLS(enqueue);
  onLCP(enqueue);
  onINP(enqueue);
  onFCP(enqueue);
  onTTFB(enqueue);

  if (typeof window !== 'undefined') {
    timer = setInterval(() => {
      void flush();
    }, cfg.flushIntervalMs);
    window.addEventListener('pagehide', () => {
      void flush();
    });
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
  }

  return {
    flush,
    stop: () => {
      stopped = true;
      if (timer !== null) clearInterval(timer);
    },
  };
}
