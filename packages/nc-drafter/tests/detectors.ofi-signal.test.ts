// SPDX-License-Identifier: BUSL-1.1
import { describe, expect, it } from 'vitest';
import { OfiSignalDetector } from '../src/index.js';
import { attribution, makeClaim, makeContext } from './fixtures.js';

const det = new OfiSignalDetector();

describe('OfiSignalDetector', () => {
  it('emits OFI for fragile but functioning process', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'fragile',
      polarity: 'affirms',
      controlImplemented: true,
      attributions: [attribution('A.7.4', null, 0.85)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
    expect(out[0]!.type).toBe('ofi');
    expect(out[0]!.detectorId).toBe('detector.ofi_signal.v1');
  });

  it('emits OFI for manual + functioning process', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'manual',
      attributions: [attribution('A.6.2.5', null, 0.9)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
  });

  it('emits OFI for undocumented + functioning', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'undocumented',
      attributions: [attribution('A.7.4', null, 0.8)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(1);
  });

  it('does not emit when process is not functioning', () => {
    const claim = makeClaim({
      functioning: false,
      processMaturity: 'fragile',
      attributions: [attribution('A.7.4')],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit for documented or mature processes', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'documented',
      attributions: [attribution('A.7.4')],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when there are no attributions', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'fragile',
      attributions: [],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('does not emit when clause is not in catalog', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'fragile',
      attributions: [attribution('Z.99', null, 0.9)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out).toHaveLength(0);
  });

  it('confidence is 0.65 for OFIs', () => {
    const claim = makeClaim({
      functioning: true,
      processMaturity: 'fragile',
      attributions: [attribution('A.7.4', null, 0.99)],
    });
    const out = det.detect({ claims: [claim] }, makeContext());
    expect(out[0]!.confidence).toBeCloseTo(0.65, 5);
  });
});
