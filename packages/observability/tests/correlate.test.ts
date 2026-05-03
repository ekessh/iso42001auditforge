// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';

import {
  attachLedgerEventIdToActiveSpan,
  runWithCorrelationFrame,
  takeLedgerEventIdForLog,
} from '../src/correlate.js';

describe('correlate', () => {
  it('returns undefined when no frame is active', () => {
    expect(takeLedgerEventIdForLog()).toBeUndefined();
  });

  it('returns the id once and clears it on second take', () => {
    runWithCorrelationFrame(() => {
      attachLedgerEventIdToActiveSpan('led-1');
      expect(takeLedgerEventIdForLog()).toBe('led-1');
      expect(takeLedgerEventIdForLog()).toBeUndefined();
    });
  });

  it('does not bleed event ids across separate frames', () => {
    runWithCorrelationFrame(() => {
      attachLedgerEventIdToActiveSpan('led-A');
    });
    expect(takeLedgerEventIdForLog()).toBeUndefined();
  });
});
