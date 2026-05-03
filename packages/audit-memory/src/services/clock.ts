// SPDX-License-Identifier: BUSL-1.1

export interface Clock {
  now(): Date;
  nowIso(): string;
}

export const SystemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};

export function fixedClock(iso: string): Clock {
  return {
    now: () => new Date(iso),
    nowIso: () => iso,
  };
}

export function mutableClock(initialIso: string): Clock & { advance(ms: number): void; set(iso: string): void } {
  let current = new Date(initialIso);
  return {
    now: () => new Date(current),
    nowIso: () => current.toISOString(),
    advance(ms: number) {
      current = new Date(current.getTime() + ms);
    },
    set(iso: string) {
      current = new Date(iso);
    },
  };
}
