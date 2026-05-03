// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest';

import {
  getSamplerRatio,
  initOtel,
  isOtelStarted,
  shutdownOtel,
} from '../src/otel.js';

describe('initOtel', () => {
  afterEach(async () => {
    await shutdownOtel();
  });

  it('does not start the SDK when otlpEndpoint is missing', () => {
    const tracer = initOtel({ serviceName: 'test', otlpEndpoint: '' });
    expect(tracer).toBeNull();
    expect(isOtelStarted()).toBe(false);
  });

  it('starts the SDK once and is idempotent on a second call', () => {
    const t1 = initOtel({
      serviceName: 'test',
      otlpEndpoint: 'http://collector:4318',
      sampler: 0.25,
      registerShutdownHook: () => {
        /* prevent process.on side-effect during test */
      },
    });
    expect(t1).not.toBeNull();
    expect(isOtelStarted()).toBe(true);
    expect(getSamplerRatio()).toBe(0.25);
    const t2 = initOtel({
      serviceName: 'test',
      otlpEndpoint: 'http://collector:4318',
      registerShutdownHook: () => undefined,
    });
    expect(t2).not.toBeNull();
    // Ratio should remain at the value from the first init.
    expect(getSamplerRatio()).toBe(0.25);
  });

  it('clamps sampler ratio into [0, 1]', () => {
    initOtel({
      serviceName: 'test',
      otlpEndpoint: 'http://collector:4318',
      sampler: 5,
      registerShutdownHook: () => undefined,
    });
    expect(getSamplerRatio()).toBe(1);
  });
});
