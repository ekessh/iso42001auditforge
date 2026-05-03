// SPDX-License-Identifier: BUSL-1.1
import { randomUUID } from 'node:crypto';

export interface IdFactory {
  uuid(): string;
}

export const SystemIdFactory: IdFactory = {
  uuid: () => randomUUID(),
};

export function deterministicIdFactory(seed: number): IdFactory {
  let state = seed >>> 0;
  function next(): number {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state;
  }
  function hex(n: number, len: number): string {
    return next().toString(16).padStart(8, '0').slice(0, len);
  }
  return {
    uuid() {
      return [
        hex(0, 8),
        hex(0, 4),
        '4' + hex(0, 3),
        ((next() & 0x3) | 0x8).toString(16) + hex(0, 3),
        hex(0, 8) + hex(0, 4),
      ].join('-');
    },
  };
}
