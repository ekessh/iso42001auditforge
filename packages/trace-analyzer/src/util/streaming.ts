// SPDX-License-Identifier: BUSL-1.1
//
// Streaming JSON helpers. We avoid pulling whole 100k-span OTel exports into
// memory by walking arrays element-by-element via stream-json. The yielded
// objects are still parsed (we use streamArray) but only one element at a
// time is materialised, so peak memory is O(largest span) rather than O(file).
//
// PERF — BLK-4 (perf-review #4):
// The previous `importOtelStream` buffered the full payload, called
// `JSON.parse` on the whole string, then re-streamed it through the
// stream-json pipeline. At 100k spans that materialised 100-300 MB
// strings and stalled the event loop for several seconds. The new path:
//
//   - accepts `Readable | AsyncIterable<Uint8Array> | ReadableStream`
//     (web stream) input, normalised by `toNodeReadable`,
//   - feeds the bytes to `stream-json` with a path-pick filter so the
//     deeply-nested OTel envelope (`resourceSpans[*].scopeSpans[*].spans[*]`)
//     can be walked without materialising the root,
//   - applies a hard 64 MiB intermediate-buffer cap (rejected with
//     `IngestPayloadTooLarge`) so a malformed/giant JSON cannot OOM the
//     process.

import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

// `stream-json` is a CommonJS package without an ESM-compatible default
// export shape. Using `createRequire` lets us pull the `parser` factory
// in a way that works under Node's NodeNext ESM resolver — direct
// `import { parser } from 'stream-json'` fails at runtime because the
// package only exports a default function.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const streamJson = require('stream-json') as { parser: () => NodeJS.ReadWriteStream };
// eslint-disable-next-line @typescript-eslint/no-var-requires
const streamArrayMod = require('stream-json/streamers/StreamArray.js') as {
  streamArray: () => NodeJS.ReadWriteStream;
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pickMod = require('stream-json/filters/Pick.js') as {
  pick: (opts: { filter: string }) => NodeJS.ReadWriteStream;
};
const parser = streamJson.parser;
const streamArray = streamArrayMod.streamArray;
const pick = pickMod.pick;

/** 64 MiB intermediate-buffer cap for streaming ingest. */
export const MAX_INGEST_BUFFER_BYTES = 64 * 1024 * 1024;

export class IngestPayloadTooLarge extends Error {
  constructor(public readonly bytes: number, max: number) {
    super(`ingest payload exceeded buffer cap: ${bytes} > ${max} bytes`);
    this.name = 'IngestPayloadTooLarge';
  }
}

/**
 * Normalise the supported input shapes into a Node `Readable`. We accept:
 *   - a Node `Readable` (returned as-is),
 *   - an `AsyncIterable<Uint8Array | Buffer | string>`,
 *   - a `ReadableStream<Uint8Array>` (web/whatwg stream).
 *
 * The intent is that callers can pipe a request body, an `fs.createReadStream`
 * a `fetch().body`, or a string buffer without having to convert.
 */
export type StreamSource =
  | Readable
  | AsyncIterable<Uint8Array | Buffer | string>
  | ReadableStream<Uint8Array>;

export function toNodeReadable(source: StreamSource): Readable {
  if (source instanceof Readable) return source;
  // Web ReadableStream — duck-type to avoid hard dep on `dom` lib.
  if (
    typeof (source as ReadableStream<Uint8Array>).getReader === 'function' &&
    typeof (source as ReadableStream<Uint8Array>).pipeTo === 'function'
  ) {
    const web = source as ReadableStream<Uint8Array>;
    return Readable.fromWeb(web as unknown as Parameters<typeof Readable.fromWeb>[0]);
  }
  return Readable.from(source as AsyncIterable<Uint8Array | Buffer | string>);
}

/**
 * Stream an array embedded at a JSON path. The path may be empty (the root
 * is the array) or a dotted name (e.g. "resourceSpans"). Yields each
 * element of that array in document order.
 *
 * Reads from any supported source via {@link StreamSource}.
 *
 * Backpressure: the underlying stream-json pipeline propagates pause/resume
 * naturally; the async iterator surface preserves it because we await each
 * yield before the next chunk is consumed.
 */
export async function* streamJsonArray<T = unknown>(
  source: StreamSource,
  arrayPath?: string,
  opts: { maxBufferBytes?: number } = {},
): AsyncGenerator<T> {
  const max = opts.maxBufferBytes ?? MAX_INGEST_BUFFER_BYTES;
  const node = toNodeReadable(source);
  // Track high-water mark: stream-json buffers are small but the underlying
  // stream may carry runaway sizes. We reject hard at `max` bytes.
  let totalBytes = 0;
  const tap = new Readable({
    read() {
      // no-op; pushed below
    },
  });
  let aborted: Error | null = null;
  node.on('data', (chunk: Buffer | string) => {
    if (aborted) return;
    const bufLen =
      typeof chunk === 'string'
        ? Buffer.byteLength(chunk)
        : (chunk as Buffer).length;
    totalBytes += bufLen;
    if (totalBytes > max) {
      aborted = new IngestPayloadTooLarge(totalBytes, max);
      tap.destroy(aborted);
      node.destroy();
      return;
    }
    tap.push(chunk);
  });
  node.on('end', () => {
    if (!aborted) tap.push(null);
  });
  node.on('error', (err) => {
    aborted = err;
    tap.destroy(err);
  });

  const pipeline: NodeJS.ReadableStream =
    arrayPath !== undefined && arrayPath !== ''
      ? tap.pipe(parser()).pipe(pick({ filter: arrayPath })).pipe(streamArray())
      : tap.pipe(parser()).pipe(streamArray());

  for await (const chunk of pipeline as AsyncIterable<{ key: number; value: T }>) {
    yield chunk.value;
  }
}

/** Convenience: turn a string into a Readable for streaming. */
export function readableFromString(s: string): Readable {
  return Readable.from([s]);
}
