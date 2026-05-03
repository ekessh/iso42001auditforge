// SPDX-License-Identifier: BUSL-1.1
//
// Streaming JSON helpers. We avoid pulling whole 100k-span OTel exports into
// memory by walking arrays element-by-element via stream-json. The yielded
// objects are still parsed (we use streamArray) but only one element at a
// time is materialised, so peak memory is O(largest span) rather than O(file).

import { Readable } from 'node:stream';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray.js';
import { pick } from 'stream-json/filters/Pick.js';

/**
 * Stream an array embedded at a JSON path. The path may be empty (the root
 * is the array) or a dotted name (e.g. "resourceSpans"). Yields each
 * element of that array in document order.
 *
 * Reads from a Node Readable stream so callers can pipe a file, a network
 * response, or an in-memory buffer.
 */
export async function* streamJsonArray<T = unknown>(
  source: Readable,
  arrayPath?: string,
): AsyncGenerator<T> {
  const pipeline: NodeJS.ReadableStream =
    arrayPath !== undefined && arrayPath !== ''
      ? source.pipe(parser()).pipe(pick({ filter: arrayPath })).pipe(streamArray())
      : source.pipe(parser()).pipe(streamArray());

  for await (const chunk of pipeline as AsyncIterable<{ key: number; value: T }>) {
    yield chunk.value;
  }
}

/** Convenience: turn a string into a Readable for streaming. */
export function readableFromString(s: string): Readable {
  return Readable.from([s]);
}
