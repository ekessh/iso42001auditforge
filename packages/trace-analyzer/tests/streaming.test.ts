// SPDX-License-Identifier: BUSL-1.1
//
// BLK-4 perf-regression tests for the streaming JSON helpers and the
// OTel importer's true-streaming path.
//
// We exercise:
//   - the 64 MiB intermediate-buffer cap
//   - streaming through Node `Readable`, web `ReadableStream`, and
//     `AsyncIterable<Uint8Array>` sources
//   - shape detection (array / flat / envelope) without `JSON.parse`
//     of the root
//   - 100k-span ingest (documented SLO target — informational only)

import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  IngestPayloadTooLarge,
  MAX_INGEST_BUFFER_BYTES,
  readableFromString,
  streamJsonArray,
  toNodeReadable,
} from '../src/util/streaming.js';
import { importOtelStream } from '../src/importers/trace.js';

const ENG = '00000000-0000-0000-0000-000000000001';

function makeOtelEnvelope(numSpans: number): string {
  // Build an envelope with one resource, one scope, and N spans. We
  // assemble the JSON manually to avoid allocating an object graph the
  // size of the encoded form.
  const head =
    '{"resourceSpans":[{"resource":{},"scopeSpans":[{"scope":{},"spans":[';
  const tail = ']}]}]}';
  const parts: string[] = [head];
  for (let i = 0; i < numSpans; i++) {
    if (i > 0) parts.push(',');
    parts.push(
      `{"spanId":"s${i}","name":"op-${i}","startTimeUnixNano":"${i * 1000}","endTimeUnixNano":"${i * 1000 + 500}","attributes":[],"status":{"code":1},"events":[]}`,
    );
  }
  parts.push(tail);
  return parts.join('');
}

function makeFlatSpans(numSpans: number): string {
  const head = '{"spans":[';
  const parts: string[] = [head];
  for (let i = 0; i < numSpans; i++) {
    if (i > 0) parts.push(',');
    parts.push(
      `{"spanId":"f${i}","name":"flat-${i}","startTimeUnixNano":${i * 100},"endTimeUnixNano":${i * 100 + 50},"attributes":[],"status":{"code":1},"events":[]}`,
    );
  }
  parts.push(']}');
  return parts.join('');
}

function makeRootArray(numSpans: number): string {
  const parts: string[] = ['['];
  for (let i = 0; i < numSpans; i++) {
    if (i > 0) parts.push(',');
    parts.push(
      `{"spanId":"a${i}","name":"arr-${i}","startTimeUnixNano":${i},"endTimeUnixNano":${i + 1},"attributes":[],"status":{"code":1},"events":[]}`,
    );
  }
  parts.push(']');
  return parts.join('');
}

describe('streamJsonArray', () => {
  it('streams an embedded array path', async () => {
    const payload = '{"x":1,"items":[{"a":1},{"a":2},{"a":3}]}';
    const out: unknown[] = [];
    for await (const v of streamJsonArray<{ a: number }>(
      readableFromString(payload),
      'items',
    )) {
      out.push(v);
    }
    expect(out).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('streams a root array', async () => {
    const out: number[] = [];
    for await (const v of streamJsonArray<number>(readableFromString('[1,2,3]'))) {
      out.push(v);
    }
    expect(out).toEqual([1, 2, 3]);
  });

  it('rejects payloads larger than the intermediate buffer cap', async () => {
    // Build a payload > 64 MiB by streaming generated chunks. We use a
    // tight cap (1 KiB) so the test stays fast.
    async function* gen(): AsyncGenerator<Buffer> {
      yield Buffer.from('[');
      for (let i = 0; i < 10_000; i++) {
        yield Buffer.from(i === 0 ? '"x"' : ',"x"');
      }
      yield Buffer.from(']');
    }
    await expect(
      (async () => {
        for await (const _ of streamJsonArray<unknown>(gen(), undefined, {
          maxBufferBytes: 1024,
        })) {
          // drain
        }
      })(),
    ).rejects.toBeInstanceOf(IngestPayloadTooLarge);
  });

  it('exposes a sane default cap matching the documented constant', () => {
    expect(MAX_INGEST_BUFFER_BYTES).toBe(64 * 1024 * 1024);
  });

  it('accepts a Node Readable via toNodeReadable', async () => {
    const r = Readable.from(['[1,2]']);
    const norm = toNodeReadable(r);
    expect(norm).toBe(r);
  });

  it('accepts an AsyncIterable of Uint8Array', async () => {
    async function* gen(): AsyncGenerator<Uint8Array> {
      yield new TextEncoder().encode('[10,');
      yield new TextEncoder().encode('20]');
    }
    const out: number[] = [];
    for await (const v of streamJsonArray<number>(gen())) {
      out.push(v);
    }
    expect(out).toEqual([10, 20]);
  });

  it('accepts a web ReadableStream<Uint8Array>', async () => {
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode('[100,'));
        controller.enqueue(enc.encode('200]'));
        controller.close();
      },
    });
    const out: number[] = [];
    for await (const v of streamJsonArray<number>(stream)) {
      out.push(v);
    }
    expect(out).toEqual([100, 200]);
  });
});

describe('importOtelStream — shape detection (BLK-4)', () => {
  it('parses the envelope shape via streaming', async () => {
    const payload = makeOtelEnvelope(50);
    const trace = await importOtelStream(readableFromString(payload), {
      traceId: '00000000-0000-0000-0000-000000000010',
      engagementId: ENG,
    });
    expect(trace.spans.length).toBe(50);
    expect(trace.traceFormat).toBe('otel');
  });

  it('parses the flat {spans:[]} shape via streaming', async () => {
    const payload = makeFlatSpans(75);
    const trace = await importOtelStream(readableFromString(payload), {
      traceId: '00000000-0000-0000-0000-000000000011',
      engagementId: ENG,
    });
    expect(trace.spans.length).toBe(75);
  });

  it('parses a root array via streaming', async () => {
    const payload = makeRootArray(40);
    const trace = await importOtelStream(readableFromString(payload), {
      traceId: '00000000-0000-0000-0000-000000000012',
      engagementId: ENG,
    });
    expect(trace.spans.length).toBe(40);
  });

  it('accepts an AsyncIterable<Uint8Array> source', async () => {
    const enc = new TextEncoder();
    const payload = makeOtelEnvelope(20);
    async function* gen() {
      // Chunk the payload into 256-byte slices to simulate true streaming.
      for (let i = 0; i < payload.length; i += 256) {
        yield enc.encode(payload.slice(i, i + 256));
      }
    }
    const trace = await importOtelStream(gen(), {
      traceId: '00000000-0000-0000-0000-000000000013',
      engagementId: ENG,
    });
    expect(trace.spans.length).toBe(20);
  });

  it('100k-span envelope ingests under the documented SLO target', async () => {
    const N = 100_000;
    const payload = makeOtelEnvelope(N);
    const start = process.hrtime.bigint();
    const trace = await importOtelStream(readableFromString(payload), {
      traceId: '00000000-0000-0000-0000-000000000014',
      engagementId: ENG,
    });
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    expect(trace.spans.length).toBe(N);
    // Documented: target < 5s on commodity hardware. Informational only —
    // CI runners vary widely so we don't fail the build on wall time.
    // eslint-disable-next-line no-console
    console.log(`[BLK-4 SLO] 100k OTel spans ingested in ${elapsedMs.toFixed(0)}ms`);
  }, 60_000);
});
